import { relative } from "node:path";
import { styleText } from "node:util";
import type { LintResult } from "../types.js";

const color = (format: Parameters<typeof styleText>[0], text: string) =>
  styleText(format, text, { stream: process.stdout });

/** Human-readable output modelled on ESLint's stylish formatter. */
export default function stylish(results: readonly LintResult[]): string {
  const lines: string[] = [];
  let errors = 0;
  let warnings = 0;
  let suppressed = 0;
  for (const result of results) {
    errors += result.errorCount;
    warnings += result.warningCount;
    suppressed += result.suppressed.length;
    if (result.fatal === undefined && result.diagnostics.length === 0) continue;
    lines.push("", color("underline", relative(process.cwd(), result.file) || result.file));
    if (result.fatal !== undefined) {
      lines.push(`  ${color("red", "error")}  ${result.fatal}`);
      continue;
    }
    const rows = result.diagnostics.map((d) => [
      `${d.start.line}:${d.start.column}`,
      d.severity,
      d.message,
      `${d.code} ${d.ruleId}`,
    ]);
    const widths = [0, 1].map((col) => Math.max(...rows.map((r) => (r[col] as string).length)));
    for (const [pos, severity, message, rule] of rows as string[][]) {
      const sev = (severity as string).padEnd(widths[1] as number);
      lines.push(
        `  ${color("dim", (pos as string).padEnd(widths[0] as number))}  ${color(severity === "error" ? "red" : "yellow", sev)}  ${message}  ${color("dim", rule as string)}`,
      );
    }
  }
  const total = errors + warnings;
  if (total > 0) {
    const summary = `✖ ${total} problem${total === 1 ? "" : "s"} (${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"})`;
    lines.push("", color(errors > 0 ? "red" : "yellow", summary));
  }
  if (suppressed > 0)
    lines.push(color("dim", `${suppressed} finding(s) suppressed by the baseline`));
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}
