// Builds the submission evidence automatically: for every Reactive reaction it lists the ORIGIN tx that
// caused it, the REACTIVE tx, and the DESTINATION tx(s), plus end-to-end latency. It also audits the live
// subscriptions through Reactive's own RPC. Writes PROOF.md.
//
// How the trace works (all from Reactive's documented primitives):
//   origin tx      = LogRecord.txHash, which RoninReactive copies into its events (`originTx`)
//   reactive tx    = the transaction that emitted those events on Lasna
//   destination tx = system contract getCallbacks(reactiveTxHash): block, requester, index, chainId, destTx, err
//
// Usage:  node proof.js [--blocks 6000] [--all]
// Env:    LASNA_RPC RSC  BASE_SEPOLIA_RPC [UNICHAIN_SEPOLIA_RPC]
import { createPublicClient, defineChain, http, parseAbi } from "viem";
import { writeFileSync } from "node:fs";

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const SHOW_ALL = process.argv.includes("--all");
const BLOCKS = BigInt(arg("blocks", "6000"));

const SYSTEM = "0x8888888888888888888888888888888888888888";
const LASNA_RPC = need("LASNA_RPC");
const RSC = need("RSC");

const mk = (id, name, symbol, rpc) =>
  createPublicClient({
    chain: defineChain({ id, name, nativeCurrency: { name: symbol, symbol, decimals: 18 }, rpcUrls: { default: { http: [rpc] } } }),
    transport: http(rpc),
  });

const lasna = mk(5318007, "Reactive Lasna", "lREACT", LASNA_RPC);
const origins = {
  84532: { name: "Base Sepolia", client: process.env.BASE_SEPOLIA_RPC ? mk(84532, "Base Sepolia", "ETH", process.env.BASE_SEPOLIA_RPC) : null, scan: "https://sepolia.basescan.org/tx/" },
  1301: { name: "Unichain Sepolia", client: process.env.UNICHAIN_SEPOLIA_RPC ? mk(1301, "Unichain Sepolia", "ETH", process.env.UNICHAIN_SEPOLIA_RPC) : null, scan: "https://sepolia.uniscan.xyz/tx/" },
};

const events = parseAbi([
  "event RateObserved(uint256 indexed chainId, address indexed pool, uint256 rateBps, uint256 emaBps, uint256 utilBps, uint256 originTx)",
  "event DecisionRequestSent(uint256 indexed chainId, address indexed pool, uint256 gapBps, uint256 riskScore, uint8 trigger)",
  "event RequestObserved(uint256 indexed chainId, uint256 indexed requestId, uint256 originTx)",
  "event VerdictSeen(uint256 indexed chainId, uint256 indexed verdictId, uint8 action, uint256 secsSinceRequest, uint256 originTx)",
  "event RebalanceRequested(uint256 indexed chainId, uint256 indexed verdictId, address indexed toPool, uint256 gapBps)",
  "event PauseRequested(uint256 indexed chainId, uint256 indexed verdictId)",
  "event LoopClosed(uint256 indexed chainId, uint256 indexed verdictId, uint256 requestToRebalanceSecs, uint256 originTx)",
  "event BreakerTripped(uint256 indexed chainId, address indexed pool, uint256 utilBps)",
  "event ExitObserved(uint256 indexed chainId, address indexed pool, uint256 withdrawn, uint256 originTx)",
  "event OmniPause(uint256 indexed pausedChainId, uint256 indexed sourceChainId)",
  "event OmniHeal(uint256 indexed chainId)",
  "event StaleDetected(uint256 indexed chainId, uint256 silentForSecs)",
  "event StaleHealed(uint256 indexed chainId)",
  "event OmniSignalSent(uint256 indexed chainId, uint256 localBestBps, uint256 globalBestBps, uint256 globalBestChainId)",
  "event PoolWatched(uint256 indexed chainId, address indexed pool)",
  "event SelfFunded(uint256 reservesBefore, uint256 amount)",
  "event PlanScheduled(uint256 indexed chainId, uint256 indexed planId, uint64 nextDue, uint16 remaining)",
  "event ActionRetried(uint256 indexed chainId, uint8 kind, uint256 indexed id, uint8 attempt, uint256 originTx)",
  "event ActionStuck(uint256 indexed chainId, uint8 kind, uint256 indexed id, uint256 originTx)",
]);

const planAbi = parseAbi([
  "event PlanCreated(uint256 indexed id, address indexed owner, address indexed payee, uint128 amount, uint32 period, uint64 nextDue, uint16 remaining, uint8 mode)",
  "event PlanExecuted(uint256 indexed id, address indexed payee, uint256 amount, uint256 fromYield, uint256 fromPrincipal, uint64 nextDue, uint16 remaining)",
  "event PlanSkipped(uint256 indexed id, string reason)",
  "event PlanCancelled(uint256 indexed id)",
  "event PlanExpired(uint256 indexed id)",
]);

const systemAbi = [
  {
    type: "function",
    name: "getCallbacks",
    stateMutability: "view",
    inputs: [{ name: "reactiveTx", type: "uint256" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "blockNumber", type: "uint256" },
          { name: "sender", type: "address" },
          { name: "index", type: "uint256" },
          { name: "chainId", type: "uint256" },
          { name: "destTx", type: "uint256" },
          { name: "err", type: "bytes" },
        ],
      },
    ],
  },
];

const hex32 = (n) => `0x${BigInt(n).toString(16).padStart(64, "0")}`;
const short = (h) => `${h.slice(0, 10)}…${h.slice(-6)}`;
const link = (chainId, h) => (origins[chainId] ? `[${short(h)}](${origins[chainId].scan}${h})` : `\`${h}\``);

async function tsOfTx(client, hash) {
  if (!client) return null;
  try {
    const r = await client.getTransactionReceipt({ hash });
    const b = await client.getBlock({ blockNumber: r.blockNumber });
    return Number(b.timestamp);
  } catch {
    return null;
  }
}

async function getLogsChunked(from, to) {
  const out = [];
  for (let s = from; s <= to; s += 2000n) {
    const e = s + 1999n < to ? s + 1999n : to;
    out.push(...(await lasna.getLogs({ address: RSC, events, fromBlock: s, toBlock: e })));
  }
  return out;
}

async function subscriptionAudit() {
  try {
    const res = await fetch(LASNA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "rnk_getFilters", params: [] }),
    });
    const j = await res.json();
    const r = j.result ?? {};
    const filters = r.topicFilters ?? r.TopicFilters ?? [];
    const mine = filters.filter((f) => (f.Configs ?? []).some((c) => String(c.Contract).toLowerCase() === RSC.toLowerCase()));
    const byChain = {};
    for (const f of mine) byChain[f.ChainId] = (byChain[f.ChainId] ?? 0) + 1;
    return { version: r.version ?? r.Version, total: mine.length, byChain };
  } catch (e) {
    return { error: e.message };
  }
}

const latest = await lasna.getBlockNumber();
const from = latest > BLOCKS ? latest - BLOCKS : 0n;
console.log(`scanning Lasna blocks ${from}..${latest} for RSC ${RSC}`);
const logs = await getLogsChunked(from, latest);

const byTx = new Map();
for (const l of logs) {
  if (!byTx.has(l.transactionHash)) byTx.set(l.transactionHash, []);
  byTx.get(l.transactionHash).push(l);
}

const rows = [];
for (const [txHash, ls] of byTx) {
  const names = ls.map((l) => l.eventName);
  const interesting = names.some((n) => !["RateObserved", "OmniSignalSent"].includes(n));
  let callbacks = [];
  try {
    callbacks = await lasna.readContract({ address: SYSTEM, abi: systemAbi, functionName: "getCallbacks", args: [BigInt(txHash)] });
  } catch {
    /* records are written by validators after delivery; empty/unavailable is normal right after the event */
  }
  if (!interesting && callbacks.length === 0 && !SHOW_ALL) continue;

  const withOrigin = ls.find((l) => l.args.originTx !== undefined);
  const chainId = Number(ls[0].args.chainId ?? ls[0].args.pausedChainId ?? 0);
  const originTx = withOrigin ? hex32(withOrigin.args.originTx) : null;
  const reactiveBlock = await lasna.getBlock({ blockNumber: ls[0].blockNumber });

  const tOrigin = originTx ? await tsOfTx(origins[chainId]?.client, originTx) : null;
  const dests = [];
  for (const c of callbacks) {
    const h = hex32(c.destTx);
    const cid = Number(c.chainId);
    const t = await tsOfTx(origins[cid]?.client, h);
    dests.push({ chainId: cid, hash: h, err: c.err && c.err !== "0x" ? c.err : null, t });
  }
  const lastDest = dests.map((d) => d.t).filter(Boolean).sort().pop();
  rows.push({
    what: [...new Set(names)].join(", "),
    chainId,
    originTx,
    txHash,
    dests,
    reactiveTs: Number(reactiveBlock.timestamp),
    latency: tOrigin && lastDest ? lastDest - tOrigin : null,
    reactiveLatency: tOrigin ? Number(reactiveBlock.timestamp) - tOrigin : null,
  });
}

// ── standing orders: scan the origin vaults directly (Plan* events live on Base/Unichain) ──
const PLAN_BLOCKS = BigInt(arg("plan-blocks", "6000"));
const planVaults = [
  { chainId: 84532, address: process.env.BASE_VAULT },
  { chainId: 1301, address: process.env.UNICHAIN_VAULT },
].filter((v) => v.address && origins[v.chainId]?.client);
const planRows = [];
for (const v of planVaults) {
  const client = origins[v.chainId].client;
  let latestPlan;
  try {
    latestPlan = await client.getBlockNumber();
  } catch {
    continue;
  }
  const fromPlan = latestPlan > PLAN_BLOCKS ? latestPlan - PLAN_BLOCKS : 0n;
  // Base caps eth_getLogs at 200 blocks; Unichain's load-balanced RPC fails above ~1000 blocks.
  const step = v.chainId === 84532 ? 200n : 800n;
  for (let s = fromPlan; s <= latestPlan; s += step) {
    const e = s + step - 1n < latestPlan ? s + step - 1n : latestPlan;
    try {
      const ls = await client.getLogs({ address: v.address, events: planAbi, fromBlock: s, toBlock: e });
      for (const l of ls) planRows.push({ chainId: v.chainId, ...l });
    } catch {
      /* skip an unreadable chunk; the rest of the proof still renders */
    }
  }
}
planRows.sort((a, b) => Number(a.blockNumber - b.blockNumber));

const MODE = ["YIELD_ONLY", "YIELD_THEN_PRINCIPAL"];
const usd = (x) => (Number(x) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 });
function planDetail(l) {
  const a = l.args;
  if (l.eventName === "PlanCreated")
    return `payee ${a.payee}, ${usd(a.amount)} USDC / ${a.period}s, ${MODE[Number(a.mode)] ?? a.mode}, ${a.remaining} left`;
  if (l.eventName === "PlanExecuted")
    return `${usd(a.amount)} USDC (yield ${usd(a.fromYield)} / principal ${usd(a.fromPrincipal)}), ${a.remaining} left`;
  if (l.eventName === "PlanSkipped") return a.reason;
  return "";
}

const retried = logs.filter((l) => l.eventName === "ActionRetried").length;
const stuck = logs.filter((l) => l.eventName === "ActionStuck").length;

const audit = await subscriptionAudit();

const md = [];
md.push(`# Ronin: on-chain proof of the workflow`);
md.push(``);
md.push(`Generated ${new Date().toISOString()} from Lasna blocks ${from}..${latest}.`);
md.push(`Reactive contract (RSC): \`${RSC}\` on Reactive Lasna (5318007).`);
md.push(``);
md.push(`Every row is one reaction: the **origin** transaction that emitted the event, the **Reactive** transaction on Lasna that handled it, and the **destination** transaction(s) the callback produced (read from the system contract's \`getCallbacks\`).`);
md.push(``);
md.push(`| Reaction | Origin tx | Reactive tx (Lasna) | Destination tx | Origin→Reactive | Origin→Destination |`);
md.push(`|---|---|---|---|---|---|`);
for (const r of rows) {
  const dest = r.dests.length ? r.dests.map((d) => `${link(d.chainId, d.hash)}${d.err ? " ⚠ err" : ""}`).join("<br>") : "none";
  md.push(
    `| ${r.what} | ${r.originTx ? link(r.chainId, r.originTx) : "n/a (internal)"} | \`${r.txHash}\` | ${dest} | ${r.reactiveLatency != null ? r.reactiveLatency + "s" : "n/a"} | ${r.latency != null ? r.latency + "s" : "n/a"} |`
  );
}
md.push(``);
md.push(`Ack/retry in this window: **${retried}** \`ActionRetried\`, **${stuck}** \`ActionStuck\`.`);
md.push(``);
md.push(`## Standing orders (\`Plan*\` events on the origin vaults)`);
if (planVaults.length === 0) {
  md.push(`Set \`BASE_VAULT\` and/or \`UNICHAIN_VAULT\` to include plan payouts in this report.`);
} else {
  md.push(`| Chain | Event | Plan | Detail | Tx |`);
  md.push(`|---|---|---|---|---|`);
  for (const l of planRows) {
    md.push(
      `| ${origins[l.chainId]?.name ?? l.chainId} | ${l.eventName} | #${l.args.id} | ${planDetail(l)} | ${link(l.chainId, l.transactionHash)} |`
    );
  }
  if (planRows.length === 0) md.push(`| — | — | — | no plan events in the last ${PLAN_BLOCKS} blocks | — |`);
}
md.push(``);
md.push(`## Live subscriptions (Reactive RPC \`rnk_getFilters\`)`);
md.push(audit.error ? `Could not read: ${audit.error}` : `Filters version ${audit.version}; ${audit.total} active filters belong to the RSC: ${JSON.stringify(audit.byChain)}. Re-run after calling \`addPool\` on a vault to show the count grow with no owner call.`);
md.push(``);
md.push(`Timestamps have 1-second granularity (Reactive Omni blocks are about 1s with instant finality), so latencies are accurate to ±1s.`);

writeFileSync(new URL("./PROOF.md", import.meta.url), md.join("\n") + "\n");
console.log(md.join("\n"));
console.log(`\nwrote ai-service/PROOF.md (${rows.length} reactions)`);
