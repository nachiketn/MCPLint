#!/usr/bin/env node
/**
 * mcpsmell CLI. Exit codes follow ESLint: 0 no errors, 1 lint errors (or more
 * warnings than --max-warnings), 2 configuration or usage error.
 */
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { expandPaths, lintFiles } from "./api.js";
import { readBaseline, writeBaseline } from "./baseline.js";
import { ConfigError, loadConfig } from "./config.js";
import { formatters } from "./formatters/index.js";
import { RuleOptionsError } from "./linter.js";
import { builtinRules } from "./rules/index.js";
import type { RuleEntry } from "./types.js";
import { VERSION } from "./version.js";

const HELP = `mcpsmell ${VERSION}: architecture linter for MCP servers

Usage:
  mcpsmell [lint] <file-or-dir>...   Lint snapshot JSON files (directories: *.json inside)
  mcpsmell rules [--format json]     List rules

Options:
  -c, --config <path>          Config file (default: mcpsmell.config.{mjs,js,json} in cwd,
                               else the recommended preset)
  -f, --format <name>          stylish (default), json, sarif
  -o, --output-file <path>     Write the report to a file instead of stdout
      --rule <id>=<severity>   Override a rule, e.g. --rule tool-budget=error (repeatable)
      --preview                Enable preview rules
      --baseline <path>        Suppress findings recorded in a baseline file
      --write-baseline <path>  Record current findings as the baseline and exit 0
      --max-warnings <n>       Exit 1 when there are more than n warnings
  -h, --help                   Show help
  -v, --version                Show version
`;

function parseRuleOverride(value: string): [string, RuleEntry] {
  const match = /^([\w-]+)\s*[=:]\s*(off|warn|error|[012])$/.exec(value.trim());
  if (!match) throw new ConfigError(`--rule expects <id>=<off|warn|error>, got "${value}"`);
  const level = match[2] as string;
  return [match[1] as string, (/^\d$/.test(level) ? Number(level) : level) as RuleEntry];
}

function listRules(format: string): string {
  if (format === "json") {
    return `${JSON.stringify(
      builtinRules.map((r) => r.meta),
      null,
      2,
    )}\n`;
  }
  const rows = builtinRules.map((r) => {
    const flags = [
      r.meta.recommended ? "recommended" : "",
      r.meta.stability === "preview" ? "preview" : "",
    ]
      .filter(Boolean)
      .join(", ");
    return `${r.meta.code}  ${r.meta.id.padEnd(30)} ${r.meta.docs.description}${flags ? ` [${flags}]` : ""}`;
  });
  return `${rows.join("\n")}\n`;
}

async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c" },
      format: { type: "string", short: "f", default: "stylish" },
      "output-file": { type: "string", short: "o" },
      rule: { type: "string", multiple: true, default: [] },
      preview: { type: "boolean" },
      baseline: { type: "string" },
      "write-baseline": { type: "string" },
      "max-warnings": { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });

  if (values.help) {
    process.stdout.write(HELP);
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  const [command, ...rest] = positionals;
  if (command === "rules") {
    process.stdout.write(listRules(values.format));
    return 0;
  }
  const paths = command === "lint" ? rest : positionals;
  if (paths.length === 0) {
    process.stderr.write(HELP);
    return 2;
  }

  const formatter = formatters[values.format];
  if (formatter === undefined) {
    throw new ConfigError(
      `Unknown format "${values.format}". Use one of: ${Object.keys(formatters).join(", ")}`,
    );
  }

  const warnings: string[] = [];
  const config = await loadConfig(values.config, process.cwd());
  const results = await lintFiles(await expandPaths(paths), {
    config,
    ruleOverrides: Object.fromEntries(values.rule.map(parseRuleOverride)),
    ...(values.preview !== undefined && { preview: values.preview }),
    ...(values.baseline !== undefined && { baseline: await readBaseline(values.baseline) }),
    warnings,
  });
  for (const warning of new Set(warnings)) process.stderr.write(`mcpsmell: ${warning}\n`);

  if (values["write-baseline"] !== undefined) {
    const count = await writeBaseline(values["write-baseline"], results);
    process.stderr.write(`mcpsmell: wrote ${count} finding(s) to ${values["write-baseline"]}\n`);
    return 0;
  }

  const output = formatter(results);
  if (values["output-file"] !== undefined) await writeFile(values["output-file"], output);
  else process.stdout.write(output);

  const errors = results.reduce((n, r) => n + r.errorCount, 0);
  const warningCount = results.reduce((n, r) => n + r.warningCount, 0);
  const maxWarnings = values["max-warnings"] === undefined ? -1 : Number(values["max-warnings"]);
  if (Number.isNaN(maxWarnings)) throw new ConfigError("--max-warnings expects a number");
  return errors > 0 || (maxWarnings >= 0 && warningCount > maxWarnings) ? 1 : 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    const known = error instanceof ConfigError || error instanceof RuleOptionsError;
    const isUsage = (error as { code?: string }).code?.startsWith("ERR_PARSE_ARGS") === true;
    process.stderr.write(
      `mcpsmell: ${known || isUsage ? (error as Error).message : String((error as Error).stack ?? error)}\n`,
    );
    process.exitCode = 2;
  },
);
