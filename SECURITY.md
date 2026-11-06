# Security policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private
reporting instead: go to the repository's **Security** tab and choose
**Report a vulnerability**. You should get a response within 7 days.

Include what you found, how to reproduce it, and the impact you expect.

## Scope

- The mcpsmell linter and its rules.
- The snapshot harness in `tools/snapshot/`. It runs third-party MCP
  servers inside a container; a way for a server to escape that container or
  read host files is in scope.

Vulnerabilities in the third-party MCP servers we analyze belong with those
projects. If our research finds one, we report it to the project privately
before publishing.

## Supported versions

mcpsmell is pre-release. Fixes go into `main` only.
