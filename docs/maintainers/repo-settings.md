# Repository settings

Some guardrails live in GitHub settings rather than in files. A repository
admin applies them once. Each step links to the page where it is done.

## 1. Protect `main` (merge only after review and green CI)

1. Go to **Settings → Rules → Rulesets**.
2. Choose **New ruleset → Import a ruleset** and pick
   [`.github/rulesets/main.json`](../../.github/rulesets/main.json).
3. Review and **Create**.

What it enforces on the default branch:

- No direct pushes, force-pushes or deletion; changes arrive by pull request.
- One approving review from a code owner (`.github/CODEOWNERS`), re-approval
  after new commits, and all review threads resolved.
- All CI, dependency review and CodeQL checks green and up to date with `main`.
- Squash merges only, so history stays linear.

**Solo maintainer note.** GitHub does not let you approve your own pull
request. While you are the only maintainer, the ruleset lets repository admins
bypass the approval requirement only when merging through a pull request
(`bypass_mode: pull_request`), never by pushing directly. Required checks still
apply. Once a second maintainer joins, remove the bypass in the ruleset.

## 2. Security features

In **Settings → Advanced Security** (or **Code security**), turn on:

- **Private vulnerability reporting** (used by SECURITY.md).
- **Dependency graph** (needed by the dependency review check).
- **Dependabot alerts** and **Dependabot security updates**.
- **Secret scanning** and **Push protection**.
- **Code scanning**: leave "Default setup" off. CodeQL runs from
  `.github/workflows/codeql.yml`, and the two cannot be used together.

## 3. Pull request settings

In **Settings → General → Pull Requests**:

- Allow squash merging only, with "Default to pull request title".
- Turn on **Automatically delete head branches**.
- Turn on **Always suggest updating pull request branches**.

## 4. DCO sign-off check

Install the [DCO GitHub App](https://github.com/apps/dco) on this repository.
It adds a "DCO" check that fails when a commit lacks `Signed-off-by`. After it
has run once, add `DCO` to the required checks in the ruleset.

## 5. Actions permissions

In **Settings → Actions → General**:

- **Workflow permissions:** "Read repository contents and packages
  permissions" (workflows ask for more only where they need it).
- Turn off "Allow GitHub Actions to create and approve pull requests".
