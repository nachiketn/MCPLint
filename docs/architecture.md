# Architecture

mcpsmell is a small TypeScript CLI and library. It reads what an MCP server
exposes (tools, resources, prompts), runs rules over it, and reports findings
in formats humans and CI understand. This page explains the main design
choices and the prior art each one follows.

## Pipeline

```
snapshot JSON ──loader──▶ Manifest ──rules (visitors)──▶ Diagnostics ──formatter──▶ stylish | json | sarif
                                         ▲
                     flat config + presets + CLI overrides, baseline
```

| Module                    | Role                                                                   |
| ------------------------- | ---------------------------------------------------------------------- |
| `src/types.ts`            | `Manifest`, `Diagnostic`, `LintResult`: the contracts between stages   |
| `src/loaders/snapshot.ts` | Reads collector snapshots, bare `tools/list` results, JSON-RPC replies |
| `src/rule.ts`             | Rule API (`meta` + `create(context)`)                                  |
| `src/rules/`              | Built-in rules and shared schema/naming helpers                        |
| `src/linter.ts`           | Option validation, visitor traversal, source positions, fingerprints   |
| `src/config.ts`           | Flat config, presets, server scoping, preview gating                   |
| `src/baseline.ts`         | Baseline read/write                                                    |
| `src/formatters/`         | `stylish`, `json`, `sarif`                                             |
| `src/testing/`            | `RuleTester`                                                           |
| `src/cli.ts`              | `mcpsmell` command                                                     |

## Decisions and prior art

**The manifest is the contract.** Rules see a normalized `Manifest`, never the
raw input. Today the only loader reads JSON snapshots (from
`tools/snapshot/`); a live loader (connect to a server with the MCP SDK) and
source-code analysis can be added as new loaders or new rule families without
changing existing rules. This mirrors how ESLint separates parsers from rules.

**Rule shape from ESLint.** A rule is `{ meta, create(context) }`. `create`
returns visitor callbacks (`server`, `tool`, `resource`, `prompt`,
`server:exit`) and reports with `context.report({ messageId, data, tool, path })`.
`meta.messages` holds the templates, `meta.schema` is a JSON Schema for the
options (validated with Ajv, as ESLint does), and `meta.defaultOptions` is
merged under user options.

**Codes from Ruff and Clippy.** Each rule has a readable id
(`god-tool-dispatch`) and a stable code (`MCS201`). Config accepts either.
Codes are grouped by hundreds by category, so a code tells you the family at a
glance and new rules slot in without renumbering.

**Preview rules from Ruff.** Heuristics that are new or have a known false
positive rate (`god-tool-passthrough`, `hidden-instructions`) ship as
`stability: "preview"`. They run only with `--preview` or
`linterOptions.preview: true`, even if a config names them, and they are never
in `mcpsmell:recommended`. A rule graduates to stable once its precision on the
study corpus is measured.

**Flat config from ESLint.** The config is an array of objects merged in order,
later entries winning. Presets are named strings (`"mcpsmell:recommended"`,
`"mcpsmell:all"`) or objects exported as `configs` for JS configs. Instead of
ESLint's `files`, an entry can carry `servers` globs, since the unit here is a
server rather than a file. A bare severity keeps options set by an earlier
entry, as in ESLint.

**Locations are JSON pointers, mapped to lines.** Rules report a pointer
relative to the tool (`/inputSchema/properties/method`). The engine resolves
it to line and column in the original file with `jsonc-parser` (the same
approach Spectral uses), so editors and code scanning can jump to the exact
property.

**Fingerprints and baselines from CodeQL, SARIF and golangci-lint.** Each
finding gets a fingerprint hashed from the rule, the server id, a logical
location that uses the tool name rather than its array index, and the message
id. Reordering tools or reformatting a snapshot does not change it.
`--write-baseline` records current findings and `--baseline` suppresses them,
so a team can adopt the linter on an existing server and fail only on new
findings. In SARIF, baselined findings are kept with an `external` suppression
rather than dropped, and fingerprints go in `partialFingerprints`.

**Output.** `stylish` follows ESLint's default formatter. `json` is the raw
`LintResult[]`. `sarif` is SARIF 2.1.0 with rule metadata, help links and
fingerprints, ready for GitHub code scanning.

**Exit codes from ESLint.** 0 means no errors, 1 means lint errors (or more
warnings than `--max-warnings`), 2 means a configuration or usage error.

**Tests from ESLint's RuleTester.** Each rule's tests are a list of valid and
invalid cases, where a case is a small server (`{ tools: [...] }`) and invalid
cases list the expected message ids and pointers. Tests run on `node:test`,
so there is no test framework dependency.

**Generated rule docs.** `docs/rules.md` is generated from rule metadata
(`npm run docs`), and CI fails if it is stale, the way Ruff and Clippy keep
their rule lists in step with the code.

**Few dependencies.** Runtime dependencies are `ajv` (option schemas) and
`jsonc-parser` (positions). The CLI uses `node:util` `parseArgs` and
`styleText` rather than third-party argument or color packages.

## Not yet built

- Live loader: connect to a running server over stdio or HTTP with the MCP SDK.
- Source rules for patterns that need code, such as synchronous long-running
  operations and unsanitized resource content (planned with Semgrep rules).
- LLM-judged description quality, advisory only.
- A language server for editor integration.
