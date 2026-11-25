// Read-only deployment check: `npm run verify`.
// No private keys, no writes. Every check prints PASS or FAIL.
// Env (all optional, public deployment defaults are used):
//   LASNA_RPC, BASE_SEPOLIA_RPC, UNICHAIN_SEPOLIA_RPC, RSC,
//   BASE_VAULT, BASE_REGISTRY, UNICHAIN_VAULT, UNICHAIN_REGISTRY
import { createPublicClient, decodeEventLog, defineChain, formatEther, http, parseAbi, toEventSelector } from "viem";

const RSC = process.env.RSC ?? "0x69107baF143C38722744a09e3f27c3c076469d5f";
const SYSTEM = "0x8888888888888888888888888888888888888888";
const BASE_VAULT = (process.env.BASE_VAULT ?? "0xCD50707FED3Ef829b0965D6DDCF0Dab56e5cce66");
const BASE_REGISTRY = (process.env.BASE_REGISTRY ?? "0x1Ba4da5288751378c1813a256885c7e376592D34");
const UNI_VAULT = (process.env.UNICHAIN_VAULT ?? "0xce75a97917c8fd52eA30684F0988FAe4485D64cD");
const UNI_REGISTRY = (process.env.UNICHAIN_REGISTRY ?? "0xA97D4F33F029928B8c0B54Ee47129Aa39F51007f");

const BASE_RPC = process.env.BASE_SEPOLIA_RPC ?? "https://base-sepolia-rpc.publicnode.com";
const UNI_RPC = process.env.UNICHAIN_SEPOLIA_RPC ?? "https://unichain-sepolia-rpc.publicnode.com";
const LASNA_RPC = process.env.LASNA_RPC ?? "https://lasna-rpc.rnk.dev/";

const mk = (id, name, symbol, rpc) => {
  const chain = defineChain({ id, name, nativeCurrency: { name: symbol, symbol, decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
  return createPublicClient({ chain, transport: http(rpc) });
};
const base = mk(84532, "Base Sepolia", "ETH", BASE_RPC);
const uni = mk(1301, "Unichain Sepolia", "ETH", UNI_RPC);
const lasna = mk(5318007, "Reactive Lasna", "lREACT", LASNA_RPC);

const payAbi = parseAbi([
  "function reserves(address) view returns (uint256)",
  "function debt(address) view returns (uint256)",
]);
const rscAbi = parseAbi([
  "function activePlans() view returns (uint256)",
  "function pendingActions() view returns (uint256)",
  "function feedOn() view returns (bool)",
  "function cronOn() view returns (bool)",
  "event LoopClosed(uint256 indexed chainId, uint256 indexed verdictId, uint256 requestToRebalanceSecs, uint256 originTx)",
]);
const registryAbi = parseAbi([
  "event VerdictPosted(uint256 indexed id, address indexed targetPool, uint8 action, uint16 confidenceBps, bytes32 reasoningHash, uint256 requestId)",
]);
const vaultAbi = parseAbi(["event PlanExecuted(uint256 indexed id, address indexed payee, uint256 amount, uint256 fromYield, uint256 fromPrincipal, uint64 nextDue, uint16 remaining)"]);

let failures = 0;
function report(name, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function lastMatch(client, { address, abi, eventName, fromBlock, chunk = 50_000n }) {
  const latest = await client.getBlockNumber();
  let to = latest;
  let size = chunk;
  const eventItem = abi.find((item) => item.type === "event" && item.name === eventName);
  if (!eventItem) throw new Error(`event ${eventName} not in ABI`);
  const topic = toEventSelector(eventItem);
  while (to >= fromBlock) {
    const from = to - size + 1n > fromBlock ? to - size + 1n : fromBlock;
    let logs;
    for (let attempt = 1; ; attempt++) {
      try {
        logs = await client.getLogs({ address, topics: [topic], fromBlock: from, toBlock: to });
        break;
      } catch (e) {
        const msg = `${e.shortMessage ?? ""} ${e.message ?? ""}`.toLowerCase();
        if (/range|exceed|too many|limit|more than/.test(msg) && size > 1_000n) {
          size /= 2n;
          break;
        }
        if (attempt >= 8) throw e;
        await sleep(1_500 * attempt);
      }
    }
    if (!logs) continue;
    logs = logs.filter((l) => l.topics[0]?.toLowerCase() === topic.toLowerCase());
    if (logs.length) {
      const log = logs[logs.length - 1];
      const decoded = decodeEventLog({ abi: [eventItem], eventName, topics: log.topics, data: log.data });
      const block = await client.getBlock({ blockNumber: log.blockNumber });
      return { log: { ...log, args: decoded.args }, at: BigInt(block.timestamp) * 1000n };
    }
    to = from - 1n;
    await sleep(250);
  }
  return null;
}

/** Explorer fallback: one filtered eth_getLogs query, no block-range limit, no key. */
async function lastExplorer(explorer, address, abi, eventName) {
  const eventItem = abi.find((item) => item.type === "event" && item.name === eventName);
  const topic = toEventSelector(eventItem);
  const url = `${explorer}/api?module=logs&action=getLogs&address=${address}&fromBlock=0&toBlock=latest&topic0=${topic}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.status !== "1" || !Array.isArray(json.result) || json.result.length === 0) return null;
  const row = json.result[json.result.length - 1];
  const decoded = decodeEventLog({ abi: [eventItem], eventName, topics: row.topics, data: row.data });
  return { args: decoded.args, at: BigInt(row.timeStamp) * 1000n };
}

const ago = (ms) => {
  if (!ms) return "never";
  const s = Math.max(0, Math.round((Date.now() - Number(ms)) / 1000));
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
};

async function checkReserves() {
  try {
    const [reserves, debt] = await Promise.all([
      lasna.readContract({ address: SYSTEM, abi: payAbi, functionName: "reserves", args: [RSC] }),
      lasna.readContract({ address: SYSTEM, abi: payAbi, functionName: "debt", args: [RSC] }),
    ]);
    report("RSC reserves / debt", debt === 0n && reserves > 0n, `${formatEther(reserves)} lREACT reserves, ${formatEther(debt)} lREACT debt`);
  } catch (e) {
    report("RSC reserves / debt", false, `read failed: ${e.shortMessage ?? e.message}`);
  }
}

async function checkSubscriptions() {
  try {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
    const client = new Client({ name: "ronin-verify", version: "0.1.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL("https://mcp.rnk.dev/mcp")));
    const tools = (await client.listTools()).tools;
    const tool = tools.find((t) => t.name === "get_rc_health");
    if (!tool) throw new Error("get_rc_health not offered");
    const args = {};
    for (const k of Object.keys(tool.inputSchema?.properties ?? {})) {
      if (/^network$/i.test(k)) args[k] = "lasna";
      else if (/(address|contract|rc)/i.test(k)) args[k] = RSC;
    }
    const res = await client.callTool({ name: "get_rc_health", arguments: args });
    const text = (res.content ?? []).map((c) => c.text ?? "").join("\n");
    const subs = text.match(/(\d+)\s*\/\s*(\d+)\s+subscriptions/i) ?? text.match(/subscriptions?[^\d]{0,20}(\d+)\s*\/\s*(\d+)/i);
    const healthy = /HEALTHY/i.test(text);
    if (subs) report("Subscriptions (MCP get_rc_health)", Number(subs[1]) === Number(subs[2]) && healthy, `${subs[1]}/${subs[2]} active${healthy ? ", HEALTHY" : ""}`);
    else report("Subscriptions (MCP get_rc_health)", healthy, healthy ? "HEALTHY; subscription count not in the report" : text.split("\n")[0]?.slice(0, 160) ?? "no report");
    await client.close();
  } catch (e) {
    report("Subscriptions (MCP get_rc_health)", false, `could not query MCP: ${e.message}`);
  }
}

async function checkLastLoop() {
  try {
    const loop = await lastMatch(lasna, { address: RSC, abi: rscAbi, eventName: "LoopClosed", fromBlock: 8_979_790n });
    if (!loop) return report("Last AI loop", false, "no LoopClosed event since deployment");
    const secs = Number(loop.log.args.requestToRebalanceSecs);
    report("Last AI loop", true, `verdict ${loop.log.args.verdictId}, ${secs} s, ${ago(loop.at)}`);
  } catch (e) {
    report("Last AI loop", false, `read failed: ${e.shortMessage ?? e.message}`);
  }
}

async function checkLastPayout() {
  try {
    const b = await lastExplorer("https://base-sepolia.blockscout.com", BASE_VAULT, vaultAbi, "PlanExecuted");
    const u = await lastExplorer("https://unichain-sepolia.blockscout.com", UNI_VAULT, vaultAbi, "PlanExecuted");
    const newest = [b, u].filter(Boolean).sort((x, y) => Number(y.at - x.at))[0];
    if (!newest) return report("Last payout", false, "no PlanExecuted event since deployment");
    const chain = newest === b ? "Base" : "Unichain";
    report("Last payout", true, `${chain}, plan ${newest.args.id}, ${Number(newest.args.amount) / 1e6} USDC, ${ago(newest.at)}`);
  } catch (e) {
    report("Last payout", false, `read failed: ${e.shortMessage ?? e.message}`);
  }
}

async function checkLastVerdict() {
  try {
    const b = await lastExplorer("https://base-sepolia.blockscout.com", BASE_REGISTRY, registryAbi, "VerdictPosted");
    const u = await lastExplorer("https://unichain-sepolia.blockscout.com", UNI_REGISTRY, registryAbi, "VerdictPosted");
    const newest = [b, u].filter(Boolean).sort((x, y) => Number(y.at - x.at))[0];
    if (!newest) return report("Last AI verdict", false, "no VerdictPosted event since deployment");
    const chain = newest === b ? "Base" : "Unichain";
    report("Last AI verdict", true, `${chain}, verdict ${newest.args.id}, action ${newest.args.action}, ${ago(newest.at)}`);
  } catch (e) {
    report("Last AI verdict", false, `read failed: ${e.shortMessage ?? e.message}`);
  }
}

async function checkRscFlags() {
  try {
    const [feed, cron, plans, pending] = await Promise.all([
      lasna.readContract({ address: RSC, abi: rscAbi, functionName: "feedOn" }),
      lasna.readContract({ address: RSC, abi: rscAbi, functionName: "cronOn" }),
      lasna.readContract({ address: RSC, abi: rscAbi, functionName: "activePlans" }),
      lasna.readContract({ address: RSC, abi: rscAbi, functionName: "pendingActions" }),
    ]);
    const consistent = !(cron === false && (plans > 0n || pending > 0n));
    report("RSC feed / cron / pending", consistent, `feed ${feed}, cron ${cron}, plans ${plans}, pending ${pending}`);
  } catch (e) {
    report("RSC feed / cron / pending", false, `read failed: ${e.shortMessage ?? e.message}`);
  }
}

console.log("Ronin read-only verification (no keys, no writes)\n");
await checkReserves();
await checkSubscriptions();
await checkLastLoop();
await checkLastVerdict();
await checkLastPayout();
await checkRscFlags();
console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
