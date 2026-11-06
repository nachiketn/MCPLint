# Pilot study: do public MCP servers show the paper's anti-patterns?

A quick feasibility check before building mcpsmell (formerly MCPLint): shallow-clone popular MCP
servers, run cheap regex probes (`probe.py`), then read the hits by hand to
separate true positives from noise. Source is read as text only; no server
was installed or run.

```
python3 -I probe.py <dir-of-clones> > probe.json
```

## Corpus (30 repos, cloned 2026-11-06, depth 1)

| Repo | Commit |
| --- | --- |
| ChromeDevTools/chrome-devtools-mcp | 0b37364 |
| Flux159/mcp-server-kubernetes | 5536776 |
| GLips/Figma-Context-MCP | c083d65 |
| ahujasid/blender-mcp | 2e4b0bc |
| awslabs/mcp | 9df57c1 |
| brave/brave-search-mcp-server | db58a46 |
| browserbase/mcp-server-browserbase | 3e6f534 |
| ckreiling/mcp-server-docker | 57a7df2 |
| cloudflare/mcp-server-cloudflare | a21972e |
| czlonkowski/n8n-mcp | be784b5 |
| exa-labs/exa-mcp-server | 93c0d5e |
| eyaltoledano/claude-task-master | c0c98d3 |
| firecrawl/firecrawl-mcp-server | a62fbfe |
| getsentry/sentry-mcp | 6c072bf |
| github/github-mcp-server | 99d6d65 |
| grafana/mcp-grafana | a57860b |
| hashicorp/terraform-mcp-server | b2df1a6 |
| heroku/heroku-mcp-server | 5108908 |
| idosal/git-mcp | c487a29 |
| makenotion/notion-mcp-server | cf16e5c |
| microsoft/mcp | 42c66a2 |
| microsoft/playwright-mcp | 3d49ff2 |
| modelcontextprotocol/servers | 3638028 |
| modelcontextprotocol/servers-archived | 9be4674 |
| mongodb-js/mongodb-mcp-server | e17fda3 |
| oraios/serena | ede329a |
| stripe/agent-toolkit | 4f1d094 |
| supabase-community/supabase-mcp | 7e5037b |
| upstash/context7 | 078c0c7 |
| wonderwhy-er/DesktopCommanderMCP | edfc903 |

## Hand-confirmed candidates (paths at the commits above)

### God Tool: enum-dispatch variant (`method`/`action`/`command` selects the operation)
- github/github-mcp-server `pkg/github/pullrequests.go:31-45` — `pull_request_read` takes `method` with 9 values (get, get_diff, get_status, get_files, ...). About 20 tools in `pkg/github` use a `method` enum; the PR template mentions a "consolidation effort", so this is deliberate.
- microsoft/mcp `core/Microsoft.Mcp.Core/src/Areas/Server/Commands/ToolLoading/NamespaceToolLoader.cs:91-115` — default "namespace" mode exposes one tool per Azure service with `{intent, command, parameters, learn}`; "single" mode (`SingleProxyToolLoader.cs`) puts all of Azure behind one tool. Literal `do_anything(action, params)`.
- czlonkowski/n8n-mcp `src/mcp/tools-n8n-manager.ts:866-871` — `n8n_manage_credentials` with `action` in list/get/create/update/delete/getSchema; annotations must be `destructiveHint: true` for all of them, including list.

### God Tool: passthrough variant (free-form command or raw request)
- awslabs/mcp `src/aws-api-mcp-server/awslabs/aws_api_mcp_server/server.py:249` — `call_aws(cli_command)` runs any AWS CLI command.
- Flux159/mcp-server-kubernetes `src/tools/kubectl-generic.ts:17-21` — `kubectl_generic`: "Execute any kubectl command".
- supabase-community/supabase-mcp `packages/mcp-server-postgrest/src/server.ts:65-68` — `postgrestRequest(method: GET|POST|PUT|PATCH|DELETE, path, body)`.
- ahujasid/blender-mcp `src/blender_mcp/server.py:793` — `execute_blender_code(code)`.

### Synchronous long-running operations
- Flux159/mcp-server-kubernetes `src/security/kubectl-flags.ts:585-591` — every kubectl/helm call goes through `execFileSync`; `src/tools/helm-operations.ts:165-170` allows 5 minutes, `src/tools/node-management.ts:119` (node drain) 5 minutes. A sync call blocks the Node event loop, so the whole server (pings, cancellation, other calls) stalls for that time. No job ID / poll path.

### Missing or vague descriptions (restates the name)
- cloudflare/mcp-server-cloudflare `apps/ai-gateway/src/tools/ai-gateway.tools.ts:12-14` `list_gateways` → "List Gateways"; `:57-59` `list_logs` → "List Logs"; `apps/radar/src/tools/radar.tools.ts:187-189` `list_autonomous_systems` → "List Autonomous Systems".
- modelcontextprotocol/servers `src/git/src/mcp_server_git/server.py:1157-1159` `git_checkout` → "Switches branches"; `:1208-1210` `git_branch` → "List Git branches".

### Tool budget (paper: about 10–15 per context)
- github/github-mcp-server: 97 tools listed in README; mitigated by toolsets (scoped default).
- microsoft/playwright-mcp: 25 tools by default (24 core + 1 tab), 72 with all `--caps`.
- ChromeDevTools/chrome-devtools-mcp: 61 tools in `docs/tool-reference.md`; `--slim` exposes 3.
- wonderwhy-er/DesktopCommanderMCP: 26; Flux159/mcp-server-kubernetes: 22.

### Unsanitized resource content (needs confirmation)
- modelcontextprotocol/servers `src/fetch/src/mcp_server_fetch/server.py:249-280` — `_recover_hidden_content` un-hides `hidden` / `display:none` elements when Readability drops most of the page. Hidden text is a known prompt-injection carrier; this re-admits it. Needs a test page to confirm.
- brave, exa, firecrawl, notion servers return third-party text with no sanitizer, filter or "untrusted content" marking found by grep. github/github-mcp-server is the counter-example: `pkg/sanitize/sanitize.go` strips invisible characters and HTML tags.

## Noise seen (what the real rules must handle)
- Regex tool counts are unreliable across SDKs; use `tools/list` snapshots.
- Thrown errors are not always a defect: the TS SDK's `McpServer` turns handler throws into `isError` results.
- Most `execSync`/`subprocess.run` hits were in CLIs, setup scripts and build tooling, not tool handlers; the rule must scope to handler bodies.
