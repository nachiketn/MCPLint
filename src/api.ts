/** Programmatic API: lint files or directories of snapshot JSON. */
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolveRules, type FlatConfig, type ResolveOptions } from "./config.js";
import { lintManifest } from "./linter.js";
import { LoadError, loadManifest } from "./loaders/snapshot.js";
import type { LintResult } from "./types.js";

export interface LintOptions extends ResolveOptions {
  config: FlatConfig;
  /** Fingerprints to suppress (from a baseline). */
  baseline?: Set<string>;
}

/** Expand directories to the *.json files directly inside them, sorted. */
export async function expandPaths(
  paths: readonly string[],
  cwd = process.cwd(),
): Promise<string[]> {
  const files: string[] = [];
  for (const path of paths) {
    const full = resolve(cwd, path);
    const info = await stat(full);
    if (info.isDirectory()) {
      const entries = await readdir(full);
      files.push(
        ...entries
          .filter((e) => e.endsWith(".json"))
          .sort()
          .map((e) => join(full, e)),
      );
    } else {
      files.push(full);
    }
  }
  return [...new Set(files)];
}

export async function lintFiles(
  files: readonly string[],
  options: LintOptions,
): Promise<LintResult[]> {
  const results: LintResult[] = [];
  for (const file of files) {
    let manifest;
    try {
      manifest = await loadManifest(file);
    } catch (error) {
      if (!(error instanceof LoadError) && (error as NodeJS.ErrnoException).code === undefined)
        throw error;
      results.push({
        file,
        serverId: "",
        diagnostics: [],
        suppressed: [],
        errorCount: 1,
        warningCount: 0,
        fatal: (error as Error).message,
      });
      continue;
    }
    const rules = resolveRules(options.config, manifest.id, options);
    const all = lintManifest(manifest, rules);
    const suppressed = options.baseline
      ? all.filter((d) => options.baseline?.has(d.fingerprint))
      : [];
    const diagnostics = all.filter((d) => !suppressed.includes(d));
    results.push({
      file,
      serverId: manifest.id,
      diagnostics,
      suppressed,
      errorCount: diagnostics.filter((d) => d.severity === "error").length,
      warningCount: diagnostics.filter((d) => d.severity === "warning").length,
    });
  }
  return results;
}
