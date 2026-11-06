/**
 * Baselines, after golangci-lint `new-from-rev`, SonarQube and Ruff's
 * per-file ignores: record today's findings by fingerprint so that only new
 * findings fail the build. Fingerprints use the tool name, not its array
 * index, so reordering tools does not invalidate a baseline.
 */
import { readFile, writeFile } from "node:fs/promises";
import type { Diagnostic, LintResult } from "./types.js";

export interface BaselineEntry {
  fingerprint: string;
  ruleId: string;
  serverId: string;
  location: string;
}

export interface Baseline {
  version: 1;
  findings: BaselineEntry[];
}

export async function readBaseline(path: string): Promise<Set<string>> {
  const data = JSON.parse(await readFile(path, "utf8")) as Partial<Baseline>;
  if (data.version !== 1 || !Array.isArray(data.findings)) {
    throw new Error(`${path} is not a mcpsmell baseline (version 1)`);
  }
  return new Set(data.findings.map((f) => f.fingerprint));
}

export async function writeBaseline(path: string, results: readonly LintResult[]): Promise<number> {
  const findings: BaselineEntry[] = results
    .flatMap((r) => [...r.diagnostics, ...r.suppressed])
    .map((d: Diagnostic) => ({
      fingerprint: d.fingerprint,
      ruleId: d.ruleId,
      serverId: d.serverId,
      location: d.logicalLocation,
    }))
    .sort((a, b) => a.serverId.localeCompare(b.serverId) || a.location.localeCompare(b.location));
  const baseline: Baseline = { version: 1, findings };
  await writeFile(path, `${JSON.stringify(baseline, null, 2)}\n`);
  return findings.length;
}
