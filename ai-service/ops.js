// Ronin Ops agent: keeps the whole loop alive with nobody babysitting the fees.
//
// Why it exists (Reactive economy rules, dev.reactive.network/economy):
//   * "Execution stops whenever debt > 0": react() AND callback delivery both stop.
//   * A reverted react() or failed callback is still charged. There are no refunds.
//   * Reactive contracts pay in REACT; callback contracts pay in the destination chain's ETH.
// So every minute this agent reads balance / reserves / debt for the RSC (Lasna) and for every vault and
// requester (via the callback proxy), and tops up with depositTo() before anything goes silent.
// Optionally it asks Reactive MCP (https://mcp.rnk.dev/mcp, read-only diagnostics) for get_rc_health and
// attaches the report. A tiny HTTP endpoint (/status) feeds your dashboard.
//
// Env: LASNA_RPC RSC  OPS_PK (defaults to AI_POSTER_PK)  and per chain (active when *_VAULT is set):
//   BASE_SEPOLIA_RPC BASE_VAULT BASE_REQUESTER [BASE_CALLBACK_PROXY]
//   UNICHAIN_SEPOLIA_RPC UNICHAIN_VAULT UNICHAIN_REQUESTER [UNICHAIN_CALLBACK_PROXY]
// Optional: OPS_INTERVAL_SEC=60 OPS_PORT=8787 OPS_MIN_REACT=0.5 OPS_TOPUP_REACT=1 OPS_MIN_ETH=0.002 OPS_TOPUP_ETH=0.005 OPS_MCP=1
import { createPublicClient, createWalletClient, defineChain, formatEther, http, parseAbi, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";

const need = (k) => {
  const v = process.env[k];
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};
const num = (k, d) => (process.env[k] ? Number(process.env[k]) : d);

const SYSTEM = "0x8888888888888888888888888888888888888888";
need("LASNA_RPC");
const RSC = need("RSC");
const account = privateKeyToAccount(process.env.OPS_PK ?? need("AI_POSTER_PK"));
const INTERVAL = num("OPS_INTERVAL_SEC", 60) * 1000;
const MIN_REACT = parseEther(String(num("OPS_MIN_REACT", 0.5)));
const TOPUP_REACT = parseEther(String(num("OPS_TOPUP_REACT", 1)));
const MIN_ETH = parseEther(String(num("OPS_MIN_ETH", 0.002)));
const TOPUP_ETH = parseEther(String(num("OPS_TOPUP_ETH", 0.005)));
const MCP_ON = process.env.OPS_MCP !== "0";
const ONCE = process.argv.includes("--once");

const payAbi = parseAbi([
  "function debt(address) view returns (uint256)",
  "function reserves(address) view returns (uint256)",
  "function depositTo(address) payable",
]);

const rscAbi = parseAbi([
  "function estimatedBurnPerHour() view returns (uint256)",
  "function cronOn() view returns (bool)",
  "function activePlans() view returns (uint256)",
  "function pendingActions() view returns (uint256)",
]);

const mk = (id, name, symbol, rpc) => {
  const chain = defineChain({ id, name, nativeCurrency: { name: symbol, symbol, decimals: 18 }, rpcUrls: { default: { http: [rpc] } } });
  return { pub: createPublicClient({ chain, transport: http(rpc) }), wallet: createWalletClient({ account, chain, transport: http(rpc) }) };
};

const lasna = mk(5318007, "Reactive Lasna", "lREACT", need("LASNA_RPC"));
const CHAIN_DEFS = [
  { key: "BASE", id: 84532, name: "Base Sepolia", rpcEnv: "BASE_SEPOLIA_RPC", proxy: "0x476F44b11F5C942c58f4c8E3d0300E5710743585" },
  { key: "UNICHAIN", id: 1301, name: "Unichain Sepolia", rpcEnv: "UNICHAIN_SEPOLIA_RPC", proxy: "0x775c9B990ADe401060B78D0e98684eEf8d2466C1" },
];
const chains = CHAIN_DEFS.filter((d) => process.env[`${d.key}_VAULT`]).map((d) => ({
  ...d,
  ...mk(d.id, d.name, "ETH", need(d.rpcEnv)),
  proxy: process.env[`${d.key}_CALLBACK_PROXY`] ?? d.proxy,
  vault: need(`${d.key}_VAULT`),
  requester: process.env[`${d.key}_REQUESTER`],
}));

const status = { startedAt: new Date().toISOString(), cycle: 0, ops: account.address, targets: [], actions: [], mcp: null, aiLatency: [] };
const addAction = (a) => {
  status.actions.unshift({ at: new Date().toISOString(), ...a });
  status.actions.length = Math.min(status.actions.length, 25);
  console.log(`[action] ${a.target}: ${a.note}`);
};

/** Read balance/reserves/debt and top up with depositTo when reserves are low or debt exists. */
async function check({ label, client, payer, addr, minWei, topupWei, symbol }) {
  const [balance, reserves, debt] = await Promise.all([
    client.pub.getBalance({ address: addr }),
    client.pub.readContract({ address: payer, abi: payAbi, functionName: "reserves", args: [addr] }),
    client.pub.readContract({ address: payer, abi: payAbi, functionName: "debt", args: [addr] }),
  ]);
  const row = {
    label,
    address: addr,
    symbol,
    balance: formatEther(balance),
    reserves: formatEther(reserves),
    debt: formatEther(debt),
    state: debt > 0n ? "IN_DEBT" : reserves < minWei ? "LOW" : "OK",
  };
  if (debt > 0n) {
    // Loud on purpose: with debt > 0 Reactive stops executing react() AND delivering callbacks, so the
    // whole loop is silently dead until it is paid off. Never let this scroll by unnoticed.
    console.error(
      `\n!!! DEBT on ${label} (${addr}): ${formatEther(debt)} ${symbol} owed — execution is STOPPED until covered !!!\n`,
    );
    row.alert = "DEBT: execution stopped";
  }
  if (row.state !== "OK") {
    try {
      const mine = await client.pub.getBalance({ address: account.address });
      if (mine < topupWei) {
        addAction({ target: label, note: `needs funds but ops wallet has only ${formatEther(mine)} ${symbol}` });
      } else {
        const tx = await client.wallet.writeContract({ address: payer, abi: payAbi, functionName: "depositTo", args: [addr], value: topupWei });
        addAction({ target: label, note: `depositTo ${formatEther(topupWei)} ${symbol} (${row.state}) tx=${tx}` });
        row.toppedUp = tx;
      }
    } catch (e) {
      addAction({ target: label, note: `top-up failed: ${e.shortMessage ?? e.message}` });
    }
  }
  return row;
}

// ── optional: Reactive MCP, read-only diagnostics ──
let mcp = null;
async function mcpHealth() {
  if (!MCP_ON) return;
  try {
    if (!mcp) {
      const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
      const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
      const client = new Client({ name: "ronin-ops", version: "0.1.0" });
      await client.connect(new StreamableHTTPClientTransport(new URL("https://mcp.rnk.dev/mcp")));
      const tools = (await client.listTools()).tools;
      console.log(`[mcp] connected, tools: ${tools.map((t) => t.name).join(", ")}`);
      mcp = { client, tools };
    }
    const tool = mcp.tools.find((t) => t.name === "get_rc_health");
    if (!tool) throw new Error("get_rc_health not offered by server");
    // The page does not list parameter names, so fill them from the server's own schema.
    const args = {};
    for (const k of Object.keys(tool.inputSchema?.properties ?? {})) {
      if (/^network$/i.test(k)) args[k] = "lasna";
      else if (/(address|contract|rc)/i.test(k)) args[k] = RSC;
    }
    const res = await mcp.client.callTool({ name: "get_rc_health", arguments: args });
    const text = (res.content ?? []).map((c) => c.text ?? "").join("\n");
    status.mcp = {
      at: new Date().toISOString(),
      verdict: (text.match(/Verdict[^A-Z_]*([A-Z][A-Z_]{3,})/) ?? [])[1] ?? null,
      confidence: (text.match(/Confidence[^a-z]*(proven|likely|cannot_prove)/i) ?? [])[1] ?? null,
      report: text.slice(0, 1200),
    };
  } catch (e) {
    status.mcp = { at: new Date().toISOString(), error: e.message };
    mcp = null; // reconnect next cycle
  }
}

async function cycle() {
  status.cycle++;
  const targets = [];
  try {
    const rscRow = await check({ label: "RSC (Lasna)", client: lasna, payer: SYSTEM, addr: RSC, minWei: MIN_REACT, topupWei: TOPUP_REACT, symbol: "lREACT" });
    try {
      // The RSC's own estimate of what a cron tick costs at the per-tick caps, so the top-up threshold can
      // be sanity-checked against the burn instead of guessed.
      const [gasPerHour, cronOn, plans, actions] = await Promise.all([
        lasna.pub.readContract({ address: RSC, abi: rscAbi, functionName: "estimatedBurnPerHour" }),
        lasna.pub.readContract({ address: RSC, abi: rscAbi, functionName: "cronOn" }),
        lasna.pub.readContract({ address: RSC, abi: rscAbi, functionName: "activePlans" }),
        lasna.pub.readContract({ address: RSC, abi: rscAbi, functionName: "pendingActions" }),
      ]);
      rscRow.cron = { on: cronOn, gasPerHour: Number(gasPerHour), activePlans: Number(plans), pendingActions: Number(actions) };
      if (!cronOn && (plans > 0n || actions > 0n)) {
        console.error(`!!! CRON is OFF but the RSC still has work (plans=${plans}, unacked=${actions}) — check the subscription !!!`);
      }
    } catch {
      /* older build without the estimator: ignore */
    }
    targets.push(rscRow);
    for (const c of chains) {
      targets.push(await check({ label: `Vault (${c.name})`, client: c, payer: c.proxy, addr: c.vault, minWei: MIN_ETH, topupWei: TOPUP_ETH, symbol: "ETH" }));
      if (c.requester)
        targets.push(await check({ label: `Requester (${c.name})`, client: c, payer: c.proxy, addr: c.requester, minWei: MIN_ETH, topupWei: TOPUP_ETH, symbol: "ETH" }));
    }
    status.targets = targets;
  } catch (e) {
    console.error("cycle error:", e.shortMessage ?? e.message);
  }
  if (status.cycle % num("OPS_MCP_EVERY", 5) === 1) await mcpHealth();
  try {
    const f = new URL("./latency.jsonl", import.meta.url);
    if (existsSync(f)) status.aiLatency = readFileSync(f, "utf8").trim().split("\n").slice(-10).map((l) => JSON.parse(l));
  } catch {
    /* optional */
  }
  status.updatedAt = new Date().toISOString();
  console.log(`[cycle ${status.cycle}] ` + status.targets.map((t) => `${t.label}=${t.state}`).join("  "));
}

if (ONCE) {
  await cycle();
  console.log(JSON.stringify(status, null, 2));
  process.exit(0);
}

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(status));
}).listen(num("OPS_PORT", 8787), () => console.log(`ops status on :${num("OPS_PORT", 8787)}/status`));

console.log(`Ronin ops agent up. wallet=${account.address} interval=${INTERVAL / 1000}s chains=${chains.map((c) => c.name).join(", ") || "none"}`);
await cycle();
setInterval(() => cycle().catch((e) => console.error(e.message)), INTERVAL);
