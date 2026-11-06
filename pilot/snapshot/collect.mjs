// Snapshot collector: launch each server over stdio and save what an agent would see.
// Usage: node collect.mjs [servers.json] [outDir] [id ...]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "node:fs";
import path from "node:path";

const [serversFile = "servers.json", outDir = "/out", ...only] = process.argv.slice(2);
const servers = JSON.parse(fs.readFileSync(serversFile, "utf8"));
const CONNECT_TIMEOUT = Number(process.env.CONNECT_TIMEOUT_MS ?? 240_000); // first run downloads the package
const LIST_TIMEOUT = 60_000;
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 3);
fs.mkdirSync(outDir, { recursive: true });

const withTimeout = (p, ms, what) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms} ms: ${what}`)), ms))]);

async function listAll(fn, key) {
  const items = [];
  let cursor;
  do {
    const r = await withTimeout(fn(cursor ? { cursor } : undefined), LIST_TIMEOUT, key);
    items.push(...r[key]);
    cursor = r.nextCursor;
  } while (cursor);
  return items;
}

async function snapshot(s) {
  const transport = new StdioClientTransport({
    command: s.cmd,
    args: s.args,
    env: { ...process.env, ...(s.env ?? {}) },
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (d) => { stderr = (stderr + d).slice(-4000); });
  const client = new Client({ name: "mcpsmell-snapshot", version: "0.1.0" });
  const out = {
    id: s.id, repo: s.repo, lang: s.lang,
    command: [s.cmd, ...s.args].join(" "),
    collectedAt: new Date().toISOString(),
  };
  try {
    await withTimeout(client.connect(transport), CONNECT_TIMEOUT, "connect");
    out.serverInfo = client.getServerVersion();
    out.capabilities = client.getServerCapabilities();
    out.instructions = client.getInstructions?.() ?? null;
    if (out.capabilities?.tools) out.tools = await listAll((p) => client.listTools(p), "tools");
    if (out.capabilities?.resources) {
      try { out.resources = await listAll((p) => client.listResources(p), "resources"); } catch (e) { out.resourcesError = String(e); }
      try { out.resourceTemplates = await listAll((p) => client.listResourceTemplates(p), "resourceTemplates"); } catch (e) { out.resourceTemplatesError = String(e); }
    }
    if (out.capabilities?.prompts) {
      try { out.prompts = await listAll((p) => client.listPrompts(p), "prompts"); } catch (e) { out.promptsError = String(e); }
    }
  } catch (e) {
    out.error = String(e);
    out.stderr = stderr;
  } finally {
    try { await client.close(); } catch {}
  }
  fs.writeFileSync(path.join(outDir, `${s.id}.json`), JSON.stringify(out, null, 2));
  console.log(`${s.id.padEnd(24)} ${out.error ? "FAILED  " + out.error : `${out.tools?.length ?? 0} tools`}`);
  return !out.error;
}

const queue = servers.filter((s) => only.length === 0 || only.includes(s.id));
let ok = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) if (await snapshot(queue.shift())) ok++;
}));
console.log(`\nDone: ${ok} succeeded. Snapshots are in ${outDir}`);
process.exit(0);
