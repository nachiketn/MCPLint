# mcpsmell

A linter for Model Context Protocol (MCP) servers that detects the architecture
anti-patterns described in Rodrigues & Vas,
["MCP Server Architecture Patterns for LLM-Integrated Applications"](https://arxiv.org/abs/2606.30317)
(ICSME 2026), such as God Tools, unsanitized
resource content, synchronous long-running operations and vague tool
descriptions.

Status: pre-alpha. The linter runs on JSON snapshots of a server's tool list;
`tools/snapshot/` captures those snapshots from real servers in a sandbox.

## Usage

```
npm ci && npm run build
node dist/src/cli.js path/to/snapshots/          # every *.json in the folder
node dist/src/cli.js server.json -f sarif -o mcpsmell.sarif
node dist/src/cli.js rules                       # list rules
```

A snapshot can be a file written by `tools/snapshot/`, a bare `tools/list`
result (`{ "tools": [...] }`), or a JSON-RPC response that wraps one.

```
test/fixtures/snapshots/ops-server.json
  14:11  warning  Tool 'cluster' dispatches 4 operations through 'action', mixing reads and writes (list, describe, scale, delete). Split it at least by risk class.  MCS201 god-tool-dispatch
  23:24  warning  Tool 'cluster' is annotated readOnlyHint: true but its 'action' includes writes (scale, delete). Clients may skip approval for them.  MCS301 coarse-annotations
  34:5   error    Tool 'get_logs_v2' has no description.  MCS101 missing-description
```

Rules are listed in [docs/rules.md](docs/rules.md). Configure them with a flat
config file, `mcpsmell.config.json` (or `.mjs`), in the current directory:

```json
[
  "mcpsmell:recommended",
  { "rules": { "tool-budget": ["error", { "max": 20 }], "MCS103": "off" } },
  { "servers": ["github*"], "rules": { "god-tool-dispatch": "off" } }
]
```

Other options: `--preview` enables preview rules, `--rule id=severity`
overrides a rule, and `--write-baseline file` / `--baseline file` let you adopt
the linter on an existing server and fail only on new findings. Design notes
and the prior art behind them are in [docs/architecture.md](docs/architecture.md).

(Formerly MCPLint.)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go through
[SECURITY.md](SECURITY.md). This project follows the
[Code of Conduct](CODE_OF_CONDUCT.md) and is licensed under Apache-2.0.
