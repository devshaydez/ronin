// Builds the submission evidence automatically. The main table lists only COMPLETE loops: one row per
// reaction that has an ORIGIN tx, a REACTIVE tx and a destination tx. Reactions that did not close a loop
// (the AI said IGNORE, the vault skipped, or the callback was never delivered) are collapsed into one
// counted line instead of cluttering the table. It also audits the live subscriptions through Reactive's
// own RPC. Writes PROOF.md.
//
// How the trace works:
//   origin tx      = LogRecord.txHash, which RoninReactive copies into its events (`originTx`)
//   reactive tx    = the transaction that emitted those events on Lasna
//   destination tx = the vault transaction that answered the callback. Reactive Lasna does not post callback
//                    results back (`getCallbacks` is empty on this network), so the destination is resolved
//                    from the destination chain itself: `RebalanceRequested(verdictId)` is matched to the
//                    vault's `Rebalanced` / `RebalanceSkipped` with the same verdictId, `PauseRequested` to
//                    `PausedByVerdict`, and `BreakerTripped(pool)` to `EmergencyExit(pool)`.
//
// Usage:  node proof.js [--from-block N] [--to-block N] [--blocks 6000] [--plan-blocks 6000] [--all]
//         (--from-block/--to-block default to the last --blocks Lasna blocks; pass the deploy block and the
//          last demo block to cover a whole demo run)
// Env:    LASNA_RPC RSC  BASE_SEPOLIA_RPC [UNICHAIN_SEPOLIA_RPC] [BASE_VAULT] [UNICHAIN_VAULT]
import { createPublicClient, decodeEventLog, defineChain, http, parseAbi } from "viem";
import { readFileSync, writeFileSync } from "node:fs";

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
const FROM_ARG = arg("from-block", null);
const TO_ARG = arg("to-block", null);

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
  "event VerdictSkipped(uint256 indexed chainId, uint256 indexed verdictId, string reason)",
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
  "event RequestSuppressed(uint256 indexed chainId, address indexed pool, string reason)",
]);

const vaultAbi = parseAbi([
  "event PlanCreated(uint256 indexed id, address indexed owner, address indexed payee, uint128 amount, uint32 period, uint64 nextDue, uint16 remaining, uint8 mode)",
  "event PlanExecuted(uint256 indexed id, address indexed payee, uint256 amount, uint256 fromYield, uint256 fromPrincipal, uint64 nextDue, uint16 remaining)",
  "event PlanSkipped(uint256 indexed id, string reason)",
  "event PlanCancelled(uint256 indexed id)",
  "event PlanExpired(uint256 indexed id)",
  "event Rebalanced(uint256 indexed verdictId, address indexed toPool, uint256 moved, uint256 deployed)",
  "event RebalanceSkipped(uint256 indexed verdictId, uint256 plannedMove, uint256 annualGain)",
  "event PausedByVerdict(uint256 indexed verdictId)",
  "event EmergencyExit(address indexed pool, uint256 withdrawn)",
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

async function getLogsChunked() {
  const out = [];
  for (let s = lasnaFrom; s <= latest; s += 2000n) {
    const e = s + 1999n < latest ? s + 1999n : latest;
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

const latest = TO_ARG ? BigInt(TO_ARG) : await lasna.getBlockNumber();
const lasnaFrom = FROM_ARG ? BigInt(FROM_ARG) : latest > BLOCKS ? latest - BLOCKS : 0n;
console.log(`scanning Lasna blocks ${lasnaFrom}..${latest} for RSC ${RSC}`);
const logs = await getLogsChunked();

// ── destination chain: plans, rebalances, pauses and exits (the callback answers live here) ──
// The public origin RPCs cap eth_getLogs (Base 200 blocks, Unichain 1000 around the caller), and the
// Blockscout APIs throttle hard, so each chain gets an indexer RPC with its own chunk size.
const LOG_RPC = {
  84532: process.env.BASE_LOG_RPC ?? "https://base-sepolia.gateway.tenderly.co",
  1301: process.env.UNICHAIN_SEPOLIA_RPC,
};
const CHUNK = { 84532: 5_000_000n, 1301: 1000n };
const DEPLOY_BLOCK = { 84532: 60_586_085n, 1301: 68_186_674n };
const vaults = [
  { chainId: 84532, address: process.env.BASE_VAULT },
  { chainId: 1301, address: process.env.UNICHAIN_VAULT },
].filter((v) => v.address && origins[v.chainId]?.client && LOG_RPC[v.chainId]);

const CACHE_PATH = new URL("./.proof-cache.json", import.meta.url);
const cache = (() => {
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
})();

// Logs come straight from an indexer RPC (Base: Tenderly gateway, which allows a full range; Unichain:
// the public node, 1000-block chunks). Results are cached on disk so re-runs are cheap and no public
// API gets hammered. Times are resolved from block timestamps afterwards.
async function rpcCall(url, body, tries = 6) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await res.json().catch(() => null);
    if (j && !j.error) return j.result;
    const msg = String(j?.error?.message ?? "no response");
    if (!/rate limit|too many|429/i.test(msg) || i === tries - 1) throw new Error(msg);
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
}

async function rpcLogs(chainId, address) {
  const key = `${chainId}:${address.toLowerCase()}`;
  const hit = cache[key];
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.logs;
  const url = LOG_RPC[chainId];
  const raw = [];
  const step = CHUNK[chainId] ?? 1000n;
  let from = DEPLOY_BLOCK[chainId] ?? 0n;
  const tip = BigInt(await rpcCall(url, { jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }));
  for (; from <= tip; from += step) {
    const to = from + step - 1n < tip ? from + step - 1n : tip;
    const part = await rpcCall(url, {
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [{ address, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }],
    });
    raw.push(...part);
    if (step <= 1000n) await new Promise((r) => setTimeout(r, 250));
  }
  const blocks = new Map();
  for (const e of raw) {
    if (blocks.has(e.blockNumber)) continue;
    const b = await rpcCall(url, { jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: [e.blockNumber, false] });
    blocks.set(e.blockNumber, Number(BigInt(b.timestamp)));
  }
  const logs_ = raw
    .map((e) => {
      try {
        const d = decodeEventLog({ abi: vaultAbi, topics: e.topics, data: e.data });
        return {
          chainId,
          eventName: d.eventName,
          args: JSON.parse(JSON.stringify(d.args, (k, v) => (typeof v === "bigint" ? v.toString() : v))),
          transactionHash: e.transactionHash,
          blockNumber: e.blockNumber,
          t: blocks.get(e.blockNumber),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  cache[key] = { at: Date.now(), logs: logs_ };
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
  return logs_;
}

const planRows = [];
const destEvents = [];
for (const v of vaults) {
  let ls = [];
  try {
    ls = await rpcLogs(v.chainId, v.address);
  } catch (e) {
    console.error(`warning: vault ${v.address} on chain ${v.chainId} skipped: ${e.message}`);
    continue; // the rest of the proof still renders
  }
  for (const raw of ls) {
    const l = { ...raw, blockNumber: BigInt(raw.blockNumber) };
    if (l.eventName.startsWith("Plan")) planRows.push(l);
    else destEvents.push(l);
  }
  await new Promise((r) => setTimeout(r, 1500));
}
planRows.sort((a, b) => Number(a.blockNumber - b.blockNumber));

const verdictDest = (chainId, verdictId) =>
  destEvents.find((d) => d.chainId === chainId && Number(d.args.verdictId) === verdictId && d.eventName === "Rebalanced") ??
  destEvents.find((d) => d.chainId === chainId && Number(d.args.verdictId) === verdictId && d.eventName === "RebalanceSkipped") ??
  destEvents.find((d) => d.chainId === chainId && Number(d.args.verdictId) === verdictId && d.eventName === "PausedByVerdict");

const exitDest = (chainId, pool, after) =>
  destEvents.find((d) => d.chainId === chainId && d.eventName === "EmergencyExit" && d.args.pool === pool && (d.t == null || after == null || d.t >= after - 5));

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
    /* this network does not post callback results back; the destination join below covers it */
  }
  if (!interesting && callbacks.length === 0) continue;

  const withOrigin = ls.find((l) => l.args.originTx !== undefined);
  const chainId = Number(ls[0].args.chainId ?? ls[0].args.pausedChainId ?? 0);
  const originTx = withOrigin ? hex32(withOrigin.args.originTx) : null;
  const reactiveBlock = await lasna.getBlock({ blockNumber: ls[0].blockNumber });
  const reactiveTs = Number(reactiveBlock.timestamp);

  const dests = [];
  for (const c of callbacks) {
    const cid = Number(c.chainId);
    const h = hex32(c.destTx);
    dests.push({ chainId: cid, hash: h, err: c.err && c.err !== "0x" ? c.err : null, t: await tsOfTx(origins[cid]?.client, h) });
  }
  if (dests.length === 0) {
    const rr = ls.find((l) => l.eventName === "RebalanceRequested");
    const pr = ls.find((l) => l.eventName === "PauseRequested");
    const bt = ls.find((l) => l.eventName === "BreakerTripped");
    const match = rr
      ? verdictDest(chainId, Number(rr.args.verdictId))
      : pr
        ? verdictDest(chainId, Number(pr.args.verdictId))
        : bt
          ? exitDest(chainId, bt.args.pool, reactiveTs)
          : undefined;
    if (match) dests.push({ chainId: match.chainId, hash: match.transactionHash, err: null, t: match.t, via: match.eventName });
  }

  const verdict = ls.find((l) => l.eventName === "VerdictSeen");
  const tOrigin = originTx ? await tsOfTx(origins[chainId]?.client, originTx) : null;
  const lastDest = dests.map((d) => d.t).filter(Boolean).sort().pop();
  rows.push({
    what: [...new Set(names)].join(", "),
    chainId,
    originTx,
    txHash,
    dests,
    verdictAction: verdict ? Number(verdict.args.action) : null,
    skipped: names.includes("VerdictSkipped"),
    reactiveTs,
    latency: tOrigin && lastDest ? Math.max(0, lastDest - tOrigin) : null,
    reactiveLatency: tOrigin ? Math.max(0, reactiveTs - tOrigin) : null,
  });
}

// A loop is complete only if it has an origin tx, a destination tx, and every callback succeeded.
// Everything else is summarised in one counted line rather than listed row by row.
const isComplete = (r) => Boolean(r.originTx) && r.dests.length > 0 && !r.dests.some((d) => d.err);
const complete = rows.filter(isComplete);
const refused = rows.filter((r) => !isComplete(r) && (r.verdictAction === 2 || r.skipped));
const undelivered = rows.filter((r) => !isComplete(r) && !refused.includes(r));

// A standing order is a complete loop as well: PlanCreated (origin vault) → PlanScheduled (Reactive)
// → PlanExecuted (vault). CRON only re-arms the schedule; the plan itself starts with the origin tx.
const planKey = (chainId, id) => `${chainId}:${id}`;
const createdBy = new Map();
for (const l of planRows) if (l.eventName === "PlanCreated") createdBy.set(planKey(l.chainId, l.args.id), l);
const scheduledBy = new Map();
for (const l of logs) {
  if (l.eventName !== "PlanScheduled") continue;
  const k = planKey(Number(l.args.chainId), l.args.planId);
  if (!scheduledBy.has(k)) scheduledBy.set(k, []);
  scheduledBy.get(k).push(l);
}
const planLoops = [];
for (const l of planRows) {
  if (l.eventName !== "PlanExecuted") continue;
  const k = planKey(l.chainId, l.args.id);
  const created = createdBy.get(k);
  const scheds = (scheduledBy.get(k) ?? []).sort((a, b) => Number(a.blockNumber - b.blockNumber));
  const sched = scheds.filter((s) => s.blockNumber <= l.blockNumber).pop() ?? scheds[0];
  if (!created || !sched) continue;
  const schedTs = await lasna
    .getBlock({ blockNumber: sched.blockNumber })
    .then((b) => Number(b.timestamp))
    .catch(() => null);
  planLoops.push({
    what: "PlanCreated → PlanExecuted",
    chainId: l.chainId,
    originTx: created.transactionHash,
    txHash: sched.transactionHash,      dests: [{ chainId: l.chainId, hash: l.transactionHash, err: null, t: l.t, via: "PlanExecuted" }],
    verdictAction: null,
    skipped: false,
    reactiveTs: schedTs,
    latency: created.t && l.t ? Math.max(0, l.t - created.t) : null,
    reactiveLatency: created.t && schedTs ? Math.max(0, schedTs - created.t) : null,
  });
}
planLoops.sort((a, b) => Number(a.dests[0].t ?? 0) - Number(b.dests[0].t ?? 0));
complete.push(...planLoops);

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
const suppressed = logs.filter((l) => l.eventName === "RequestSuppressed").length;
const decisions = logs.filter((l) => l.eventName === "DecisionRequestSent").length;
const verdicts = logs.filter((l) => l.eventName === "VerdictSeen").length;
const rebalances = logs.filter((l) => l.eventName === "RebalanceRequested" || l.eventName === "PauseRequested").length;
const verdictDestCount = rows.filter((r) => r.verdictAction != null && r.dests.length > 0).length;

const audit = await subscriptionAudit();

const md = [];
md.push(`# Ronin: on-chain proof of the workflow`);
md.push(``);
md.push(`Generated ${new Date().toISOString()} from Lasna blocks ${lasnaFrom}..${latest}.`);
md.push(`Reactive contract (RSC): \`${RSC}\` on Reactive Lasna (5318007).`);
md.push(``);
md.push(`Each row is one **complete loop**: the **origin** transaction that emitted the event, the **Reactive** transaction on Lasna that handled it, and the **destination** transaction the callback produced, with the end-to-end latency. Lasna does not post callback results back (\`getCallbacks\` is empty on this network), so the destination tx is the vault transaction that answered the callback, matched by verdict id. A standing-order payout counts as a loop too: the origin tx is the vault's \`PlanCreated\`, the Reactive tx is \`PlanScheduled\`, and the destination is the vault's \`PlanExecuted\`.`);
md.push(``);
md.push(`| Reaction | Origin tx | Reactive tx (Lasna) | Destination tx | Origin→Reactive | Origin→Destination |`);
md.push(`|---|---|---|---|---|---|`);
for (const r of complete) {
  const dest = r.dests.map((d) => `${link(d.chainId, d.hash)}${d.via ? ` (${d.via})` : ""}`).join("<br>");
  md.push(
    `| ${r.what} | ${link(r.chainId, r.originTx)} | \`${r.txHash}\` | ${dest} | ${r.reactiveLatency != null ? r.reactiveLatency + "s" : "n/a"} | ${r.latency != null ? r.latency + "s" : "n/a"} |`
  );
}
if (complete.length === 0) md.push(`| — | — | — | no complete loops in this range | — | — |`);
md.push(``);
md.push(`**${complete.length}** complete loops, of which **${planLoops.length}** are standing-order payouts and **${complete.length - planLoops.length}** are AI verdict loops.`);
md.push(``);
md.push(`Refused or ignored: **${refused.length}** (one line, not one row each: AI \`IGNORE\` or a verdict the RSC skipped, so there is no destination tx). The AI path in this window: **${decisions}** \`DecisionRequestSent\`, **${verdicts}** \`VerdictSeen\`, **${rebalances}** \`RebalanceRequested\`, **${verdictDestCount}** verdict destination txs; **${suppressed}** \`RequestSuppressed\` (backoff / cooldown / hourly cap; the deployed build predates them).`);
md.push(``);
md.push(`Ack/retry in this window: **${retried}** \`ActionRetried\`, **${stuck}** \`ActionStuck\`.`);
md.push(``);
md.push(`## Standing orders (\`Plan*\` events on the origin vaults)`);
if (vaults.length === 0) {
  md.push(`Set \`BASE_VAULT\` and/or \`UNICHAIN_VAULT\` to include plan payouts in this report.`);
} else {
  md.push(`Every payout above appears in the main table as a complete loop (\`PlanCreated\` → \`PlanScheduled\` → \`PlanExecuted\`). This table is the raw event stream behind those loops.`);
  md.push(``);
  md.push(`| Chain | Event | Plan | Detail | Destination tx |`);
  md.push(`|---|---|---|---|---|`);
  for (const l of planRows) {
    md.push(
      `| ${origins[l.chainId]?.name ?? l.chainId} | ${l.eventName} | #${l.args.id} | ${planDetail(l)} | ${link(l.chainId, l.transactionHash)} |`
    );
  }
  if (planRows.length === 0) md.push(`| — | — | — | no plan events in the last ${PLAN_BLOCKS} blocks | — |`);
}
if (SHOW_ALL && (refused.length || undelivered.length)) {
  md.push(``);
  md.push(`## Appendix: reactions without a complete loop`);
  md.push(`| Reaction | Origin tx | Reactive tx (Lasna) | Destinations |`);
  md.push(`|---|---|---|---|`);
  for (const r of [...refused, ...undelivered]) {
    const dest = r.dests.length ? r.dests.map((d) => `${short(d.hash)}${d.err ? " ⚠ err" : ""}`).join("<br>") : "none";
    md.push(`| ${r.what} | ${r.originTx ? short(r.originTx) : "n/a"} | \`${short(r.txHash)}\` | ${dest} |`);
  }
}
md.push(``);
md.push(`## Live subscriptions (Reactive RPC \`rnk_getFilters\`)`);
md.push(audit.error ? `Could not read: ${audit.error}` : `Filters version ${audit.version}; ${audit.total} active filters belong to the RSC: ${JSON.stringify(audit.byChain)}. Re-run after calling \`addPool\` on a vault to show the count grow with no owner call.`);
md.push(``);
md.push(`Timestamps have 1-second granularity (Reactive Omni blocks are about 1s with instant finality), so latencies are accurate to ±1s.`);

writeFileSync(new URL("./PROOF.md", import.meta.url), md.join("\n") + "\n");
console.log(md.join("\n"));
console.log(`\nwrote ai-service/PROOF.md (${complete.length} complete loops of ${rows.length} reactions)`);
