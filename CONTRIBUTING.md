# Contributing to mcpsmell

Thanks for helping. mcpsmell is a linter for Model Context Protocol (MCP)
servers, and it is also the artifact behind a research paper, so we care about
two things equally: rules that are correct, and evidence that they are.

## Ground rules

- Every change goes through a pull request. Nothing is pushed to `main`
  directly, and a pull request merges only after CI passes and a maintainer
  reviews it.
- Be kind and assume good faith. See the [Code of Conduct](CODE_OF_CONDUCT.md).
- Report security problems privately. See [SECURITY.md](SECURITY.md).

## Sign your commits (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/)
instead of a CLA. Add a sign-off line to every commit:

```
git commit -s -m "Add no-god-tool rule"
```

This appends `Signed-off-by: Your Name <you@example.com>`, which certifies you
wrote the change or have the right to submit it under the project's
Apache-2.0 license.

## Development setup

You need Node.js 22+ and Python 3.11+.

```
npm ci                     # dependencies and tooling
npm test                   # build, then run all tests
npm run typecheck          # TypeScript only
npm run docs               # regenerate docs/rules.md from rule metadata
npm run format             # format TS, JSON, Markdown, YAML
pipx run ruff check .      # lint Python
pipx run ruff format .     # format Python
```

Your editor will pick up `.editorconfig` automatically. CI also runs
ShellCheck, Hadolint and actionlint; install them locally if you touch shell
scripts, Dockerfiles or workflows.

## Pull requests

1. Open an issue first for anything bigger than a small fix, so we can agree on
   the approach before you write it.
2. Keep each pull request to one change. Fill in the template.
3. Make sure CI is green. The required checks are formatting, linter build
   and tests, Python lint, JavaScript checks, shell/Docker/workflow lint,
   dependency review and CodeQL.
4. A code owner reviews every pull request. New commits after an approval need
   a fresh approval.
5. We squash-merge, so the pull request title becomes the commit message.

## Proposing or changing a rule

Rules are the heart of the project, so they carry a higher bar:

- **Source:** cite where the rule comes from (a paper section, a published
  smell catalog, or a documented incident).
- **Evidence:** link at least one real public server that the rule flags
  correctly (a true positive) and, where possible, one it should not flag.
- **Fixtures:** add valid and invalid cases with `RuleTester` (see
  `test/rules/`). A case is a small server, usually `{ tools: [...] }`.
- **Shape:** follow [docs/architecture.md](docs/architecture.md): one file in
  `src/rules/`, `meta` with an id, a code in the right hundred, `messages`,
  and a JSON Schema for any options. Register it in `src/rules/index.ts` and
  run `npm run docs`. New heuristics start as `stability: "preview"`.
- **Severity:** rules that can fail a build must be deterministic. Rules backed
  by an LLM judge are advisory by default.

Use the "Rule proposal" issue template to start.

## Dependencies

Dependencies are pinned through lockfiles, and GitHub Actions are pinned to
commit SHAs. Dependabot opens weekly update pull requests, and dependency
review blocks pull requests that add packages with known vulnerabilities
(moderate or higher) or strong-copyleft licenses. Prefer fewer dependencies;
explain any new one in your pull request.
