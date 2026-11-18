// Ronin AI service. Hop 1 is the Reactive contract: it computes features on Reactive Network and calls
// DecisionRequester, which emits DecisionRequested. This service is woken by THAT event (not by raw
// pool events), asks the model, and posts the verdict to the AIVerdictRegistry (hop 2). The Reactive
// contract then consumes the verdict and calls the vault. The registry rejects verdicts that do not
// answer a real request, so the AI can never push an unsolicited ACT.
//
// Env (Codespaces secrets): AI_API_KEY AI_BASE_URL AI_MODEL AI_POSTER_PK
// Per chain (a chain is active when its *_REQUESTER is set):
//   BASE:      BASE_SEPOLIA_RPC      BASE_VAULT      BASE_REGISTRY      BASE_REQUESTER
//   UNICHAIN:  UNICHAIN_SEPOLIA_RPC  UNICHAIN_VAULT  UNICHAIN_REGISTRY  UNICHAIN_REQUESTER
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, parseAbiItem, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { appendFileSync } from "node:fs";

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};

const AI_BASE_URL = need("AI_BASE_URL").replace(/\/$/, "");
const AI_MODEL = need("AI_MODEL");
const AI_API_KEY = need("AI_API_KEY");
const account = privateKeyToAccount(need("AI_POSTER_PK"));

const CHAIN_DEFS = [
  { key: "BASE", id: 84532, name: "Base Sepolia", rpcEnv: "BASE_SEPOLIA_RPC" },
  { key: "UNICHAIN", id: 1301, name: "Unichain Sepolia", rpcEnv: "UNICHAIN_SEPOLIA_RPC" },
];

const poolAbi = parseAbi([
  "function rateBps() view returns (uint256)",
  "function utilizationBps() view returns (uint256)",
  "function name() view returns (string)",
]);
const vaultAbi = parseAbi([
  "function poolsLength() view returns (uint256)",
  "function pools(uint256) view returns (address)",
]);
const registryAbi = parseAbi([
  "function postVerdict(uint256 requestId, uint8 action, uint16 confidenceBps, address targetPool, bytes32 reasoningHash, string reasoning) returns (uint256)",
]);
const requestEvent = parseAbiItem(
  "event DecisionRequested(uint256 indexed id, address indexed pool, uint256 rateBps, uint256 emaBps, uint256 utilBps, uint256 gapBps, uint256 riskScore, uint8 trigger)"
);

const ACTIONS = { ACT: 1, IGNORE: 2, PAUSE: 3 };
const TRIGGERS = { 1: "rate spike vs moving average", 2: "yield gap between pools", 3: "scheduled re-score" };

function setup(def) {
  const prefix = def.key;
  if (!process.env[`${prefix}_REQUESTER`]) return null;
  const chain = defineChain({
    id: def.id,
    name: def.name,
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [need(def.rpcEnv)] } },
  });
  const transport = http(need(def.rpcEnv));
  return {
    ...def,
    pub: createPublicClient({ chain, transport }),
    wallet: createWalletClient({ account, chain, transport }),
    vault: need(`${prefix}_VAULT`),
    registry: need(`${prefix}_REGISTRY`),
    requester: need(`${prefix}_REQUESTER`),
  };
}

async function snapshot(c) {
  const n = Number(await c.pub.readContract({ address: c.vault, abi: vaultAbi, functionName: "poolsLength" }));
  const out = [];
  for (let i = 0; i < n; i++) {
    const address = await c.pub.readContract({ address: c.vault, abi: vaultAbi, functionName: "pools", args: [BigInt(i)] });
    const [name, rate, util] = await Promise.all([
      c.pub.readContract({ address, abi: poolAbi, functionName: "name" }),
      c.pub.readContract({ address, abi: poolAbi, functionName: "rateBps" }),
      c.pub.readContract({ address, abi: poolAbi, functionName: "utilizationBps" }),
    ]);
    out.push({ address, name, rateBps: Number(rate), utilizationBps: Number(util) });
  }
  return out;
}

const SYSTEM = `You are the risk engine for a yield vault that can hold USDC in lending pools.
A Reactive contract computed the features below on-chain and asked for your decision.
Rates and utilisation are in basis points (100 bps = 1%). emaBps is the moving average of the rate,
riskScore is 0..10000 (higher = riskier: sudden spikes, volatility, high utilisation).
Every pool in the snapshot is already whitelisted by the vault admin and is a valid lending pool contract;
do not ask for audits, provenance or external verification. Judge only rate, EMA, utilisation and riskScore.
Decide:
- ACT: move funds into targetPool (only if it clearly out-yields the others AND the move looks safe)
- IGNORE: do nothing (small gap, noise, or an unconvincing spike)
- PAUSE: stop new deposits (utilisation above 9000 bps, extreme or suspicious jumps, signs of an attack)
Be conservative: a sudden rate spike far above the moving average with rising utilisation is risk, not opportunity.
Reply with ONLY a JSON object: {"action":"ACT"|"IGNORE"|"PAUSE","targetPool":"<pool address or null>","confidence":<0..1>,"reasoning":"<max 280 chars>"}`;

async function askModel(pools, req) {
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0,
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify({ candidateTarget: req.pool, features: req.features, pools }) },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`no JSON in model reply: ${text.slice(0, 200)}`);
  return JSON.parse(match[0]);
}

/** Never trust the model: validate shape, clamp values, and downgrade anything inconsistent. */
function sanitize(raw, pools) {
  let action = String(raw.action ?? "").toUpperCase();
  if (!(action in ACTIONS)) action = "IGNORE";
  let confidence = Math.max(0, Math.min(1, Number(raw.confidence)));
  if (!Number.isFinite(confidence)) confidence = 0;
  let reasoning = String(raw.reasoning ?? "").slice(0, 280) || "no reasoning given";
  let target = "0x0000000000000000000000000000000000000000";

  if (action === "ACT") {
    const hit = pools.find((p) => p.address.toLowerCase() === String(raw.targetPool ?? "").toLowerCase());
    const best = [...pools].sort((a, b) => b.rateBps - a.rateBps)[0];
    if (!hit || hit.address !== best.address || hit.utilizationBps >= 9000) {
      reasoning = `[downgraded to IGNORE: target invalid or not the safest best-rate pool] ${reasoning}`.slice(0, 280);
      action = "IGNORE";
    } else target = hit.address;
  }
  return { action, confidenceBps: Math.round(confidence * 10_000), target, reasoning };
}

async function handle(c, log, seenAt) {
  const { id, pool, rateBps, emaBps, utilBps, gapBps, riskScore, trigger } = log.args;
  const req = {
    pool,
    features: {
      rateBps: Number(rateBps),
      emaBps: Number(emaBps),
      utilizationBps: Number(utilBps),
      gapBps: Number(gapBps),
      riskScore: Number(riskScore),
      trigger: TRIGGERS[Number(trigger)] ?? "unknown",
    },
  };
  console.log(`[${c.name}] request #${id} pool=${pool} ${JSON.stringify(req.features)}`);

  let verdict;
  try {
    const pools = await snapshot(c);
    verdict = sanitize(await askModel(pools, req), pools);
  } catch (e) {
    console.error(`[${c.name}] model failed, posting nothing:`, e.message);
    return;
  }
  const hash = keccak256(toBytes(verdict.reasoning));
  const tx = await c.wallet.writeContract({
    address: c.registry,
    abi: registryAbi,
    functionName: "postVerdict",
    args: [id, ACTIONS[verdict.action], verdict.confidenceBps, verdict.target, hash, verdict.reasoning],
  });
  const ms = Date.now() - seenAt;
  console.log(`[${c.name}] verdict ${verdict.action} conf=${verdict.confidenceBps} target=${verdict.target}`);
  console.log(`   tx=${tx}  ai+post=${ms}ms`);
  console.log(`   reasoning: ${verdict.reasoning}`);
  appendFileSync(
    new URL("./latency.jsonl", import.meta.url),
    JSON.stringify({ chain: c.name, requestId: id.toString(), requestTx: log.transactionHash, verdictTx: tx, verdict, aiPostMs: ms }) + "\n"
  );
}

const chains = CHAIN_DEFS.map(setup).filter(Boolean);
if (chains.length === 0) throw new Error("no chain configured: set BASE_REQUESTER (and BASE_VAULT, BASE_REGISTRY)");
console.log(`Ronin AI service up. poster=${account.address} model=${AI_MODEL} chains=${chains.map((c) => c.name).join(", ")}`);

for (const c of chains) {
  c.pub.watchEvent({
    address: c.requester,
    event: requestEvent,
    pollingInterval: 2_000,
    onLogs: (logs) => {
      const seenAt = Date.now();
      for (const l of logs) handle(c, l, seenAt).catch((e) => console.error(`[${c.name}] handler error:`, e.message));
    },
    onError: (e) => console.error(`[${c.name}] watch error:`, e.message),
  });
}
