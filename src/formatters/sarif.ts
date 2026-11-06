/**
 * SARIF 2.1.0, for GitHub code scanning and other SARIF viewers. Follows the
 * conventions code scanning documents: rule metadata in tool.driver.rules,
 * partialFingerprints for alert tracking, and baselined findings emitted with
 * an external suppression rather than dropped.
 */
import { relative } from "node:path";
import { pathToFileURL } from "node:url";
import { builtinRules } from "../rules/index.js";
import type { Diagnostic, LintResult } from "../types.js";
import { HOMEPAGE, ruleDocsUrl, VERSION } from "../version.js";

function artifactUri(file: string): string {
  const rel = relative(process.cwd(), file);
  return rel.startsWith("..") ? pathToFileURL(file).href : rel.split("\\").join("/");
}

export default function sarif(results: readonly LintResult[]): string {
  const ruleIndex = new Map(builtinRules.map((rule, i) => [rule.meta.id, i]));
  const toResult = (d: Diagnostic, suppressed: boolean) => ({
    ruleId: d.code,
    ruleIndex: ruleIndex.get(d.ruleId),
    level: d.severity,
    message: { text: d.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: artifactUri(d.file) },
          region: {
            startLine: d.start.line,
            startColumn: d.start.column,
            endLine: d.end.line,
            endColumn: d.end.column,
          },
        },
        logicalLocations: [{ fullyQualifiedName: `${d.serverId}/${d.logicalLocation}` }],
      },
    ],
    partialFingerprints: { "mcpsmell/v1": d.fingerprint },
    properties: { ruleName: d.ruleId, jsonPointer: d.pointer, serverId: d.serverId },
    ...(suppressed && { suppressions: [{ kind: "external", justification: "baseline" }] }),
  });

  const log = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "mcpsmell",
            version: VERSION,
            informationUri: HOMEPAGE,
            rules: builtinRules.map((rule) => ({
              id: rule.meta.code,
              name: rule.meta.id,
              shortDescription: { text: rule.meta.docs.description },
              fullDescription: { text: rule.meta.docs.rationale },
              helpUri: ruleDocsUrl(rule.meta.id),
              defaultConfiguration: {
                level: rule.meta.defaultSeverity === "error" ? "error" : "warning",
              },
              properties: {
                tags: [rule.meta.category, rule.meta.type, rule.meta.stability],
                source: rule.meta.docs.source,
              },
            })),
          },
        },
        results: results.flatMap((r) => [
          ...r.diagnostics.map((d) => toResult(d, false)),
          ...r.suppressed.map((d) => toResult(d, true)),
        ]),
        invocations: [
          {
            executionSuccessful: results.every((r) => r.fatal === undefined),
            toolExecutionNotifications: results
              .filter((r) => r.fatal !== undefined)
              .map((r) => ({
                level: "error",
                message: { text: r.fatal },
                locations: [
                  { physicalLocation: { artifactLocation: { uri: artifactUri(r.file) } } },
                ],
              })),
          },
        ],
      },
    ],
  };
  return `${JSON.stringify(log, null, 2)}\n`;
}
