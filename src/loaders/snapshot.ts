/**
 * Loads a server manifest from a JSON file. Accepted shapes:
 *  - a snapshot written by tools/snapshot/collect.mjs
 *    ({ id, serverInfo, capabilities, instructions, tools, resources, ... })
 *  - a bare `tools/list` result ({ tools: [...] })
 *  - a JSON-RPC response wrapping one ({ jsonrpc, id, result: { tools } })
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { JsonObject, Manifest, ManifestSource } from "../types.js";

export class LoadError extends Error {}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter(isObject) as T[]) : [];
}

export function manifestFromJson(path: string, text: string): Manifest {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new LoadError(`Invalid JSON: ${(error as Error).message}`);
  }
  if (!isObject(data)) throw new LoadError("Expected a JSON object at the top level");

  let format: ManifestSource["format"] = "snapshot";
  let body: JsonObject = data;
  let toolsPointer = "/tools";
  if (data.jsonrpc !== undefined && isObject(data.result)) {
    format = "jsonrpc";
    body = data.result;
    toolsPointer = "/result/tools";
  } else if (data.serverInfo === undefined && data.id === undefined) {
    format = "tools-list";
  }

  if (!Array.isArray(body.tools)) {
    const reason = typeof body.error === "string" ? `: ${body.error}` : "";
    throw new LoadError(`No tools array found${reason}`);
  }

  const serverInfo = isObject(body.serverInfo) ? body.serverInfo : {};
  const serverName = typeof serverInfo.name === "string" ? serverInfo.name : undefined;
  const id =
    typeof body.id === "string" && body.id !== ""
      ? body.id
      : (serverName ?? basename(path).replace(/\.json$/i, ""));

  const manifest: Manifest = {
    id,
    server: {
      ...(serverName !== undefined && { name: serverName }),
      ...(typeof serverInfo.version === "string" && { version: serverInfo.version }),
    },
    tools: arrayOf(body.tools),
    resources: arrayOf(body.resources),
    resourceTemplates: arrayOf(body.resourceTemplates),
    prompts: arrayOf(body.prompts),
    source: { path, text, format, toolsPointer },
  };
  if (typeof body.instructions === "string") manifest.instructions = body.instructions;
  if (isObject(body.capabilities)) manifest.capabilities = body.capabilities;
  return manifest;
}

export async function loadManifest(path: string): Promise<Manifest> {
  const text = await readFile(path, "utf8");
  return manifestFromJson(path, text);
}
