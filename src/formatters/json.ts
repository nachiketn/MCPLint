import type { LintResult } from "../types.js";

/** Machine-readable output: the LintResult array, one entry per file. */
export default function json(results: readonly LintResult[]): string {
  return `${JSON.stringify(results, null, 2)}\n`;
}
