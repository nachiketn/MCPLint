# mcpsmell

A linter for Model Context Protocol (MCP) servers that detects the architecture
anti-patterns described in Rodrigues & Vas,
["MCP Server Architecture Patterns for LLM-Integrated Applications"](https://arxiv.org/abs/2606.30317)
(ICSME 2026), such as God Tools, unsanitized
resource content, synchronous long-running operations and vague tool
descriptions.

Status: pre-alpha. `tools/snapshot/` captures MCP servers' tool lists in a sandbox for analysis.

(Formerly MCPLint.)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security reports go through
[SECURITY.md](SECURITY.md). This project follows the
[Code of Conduct](CODE_OF_CONDUCT.md) and is licensed under Apache-2.0.
