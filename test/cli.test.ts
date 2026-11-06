import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

// Tests run from dist/test; fixtures stay in the source tree.
const root = fileURLToPath(new URL("../../", import.meta.url));
const cli = join(root, "dist/src/cli.js");
const fixtures = join(root, "test/fixtures");

function run(args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe("cli", () => {
  it("lints a directory with the recommended preset and exits 1 on errors", () => {
    const { code, stdout } = run([join(fixtures, "snapshots")]);
    assert.equal(code, 1);
    assert.match(stdout, /MCS201 god-tool-dispatch/);
    assert.match(stdout, /MCS301 coarse-annotations/);
    assert.match(stdout, /MCS101 missing-description/);
    assert.doesNotMatch(stdout, /clean-server/);
    assert.doesNotMatch(stdout, /MCS202/, "preview rules are off by default");
  });

  it("enables preview rules with --preview", () => {
    const { stdout } = run([
      "--preview",
      "--rule",
      "god-tool-passthrough=warn",
      join(fixtures, "snapshots"),
    ]);
    assert.match(stdout, /MCS202 god-tool-passthrough/);
  });

  it("warns when a preview rule is configured without preview mode", () => {
    const { stderr } = run(["--rule", "MCS202=warn", join(fixtures, "snapshots")]);
    assert.match(stderr, /preview rule and is skipped/);
  });

  it("exits 0 when only clean files are linted", () => {
    const { code, stdout } = run([join(fixtures, "snapshots/clean-server.json")]);
    assert.equal(code, 0);
    assert.equal(stdout, "");
  });

  it("reports load failures as errors", () => {
    const { code, stdout } = run([join(fixtures, "failed-snapshot.json")]);
    assert.equal(code, 1);
    assert.match(stdout, /No tools array found: spawn npx ENOENT/);
  });

  it("writes SARIF 2.1.0 with fingerprints and rule metadata", () => {
    const { stdout } = run(["-f", "sarif", join(fixtures, "snapshots")]);
    const log = JSON.parse(stdout);
    assert.equal(log.version, "2.1.0");
    const run0 = log.runs[0];
    assert.ok(run0.tool.driver.rules.some((r: { id: string }) => r.id === "MCS201"));
    for (const result of run0.results) {
      assert.match(result.partialFingerprints["mcpsmell/v1"], /^[0-9a-f]{32}$/);
      assert.equal(run0.tool.driver.rules[result.ruleIndex].id, result.ruleId);
      assert.ok(result.locations[0].physicalLocation.region.startLine >= 1);
    }
  });

  it("points findings at the right line", () => {
    const { stdout } = run(["-f", "json", join(fixtures, "snapshots/ops-server.json")]);
    const [result] = JSON.parse(stdout);
    const dispatch = result.diagnostics.find((d: { code: string }) => d.code === "MCS201");
    const lines = readFileSync(join(fixtures, "snapshots/ops-server.json"), "utf8").split("\n");
    assert.match(lines[dispatch.start.line - 1] ?? "", /"action"/);
    assert.equal(dispatch.logicalLocation, "tool:cluster/inputSchema/properties/action");
  });

  it("suppresses baselined findings", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcpsmell-"));
    const baseline = join(dir, "baseline.json");
    assert.equal(run(["--write-baseline", baseline, join(fixtures, "snapshots")]).code, 0);
    const { code, stdout } = run(["--baseline", baseline, join(fixtures, "snapshots")]);
    assert.equal(code, 0);
    assert.match(stdout, /suppressed by the baseline/);
  });

  it("loads a flat config file", () => {
    const { code, stdout } = run([
      "-c",
      join(fixtures, "config/strict-budget.json"),
      "-f",
      "json",
      join(fixtures, "snapshots/ops-server.json"),
    ]);
    const [result] = JSON.parse(stdout);
    assert.equal(code, 1);
    assert.deepEqual(
      result.diagnostics.map((d: { code: string }) => d.code),
      ["MCS001"],
    );
  });

  it("rejects invalid rule options with exit 2", () => {
    const { code, stderr } = run([
      "-c",
      join(fixtures, "config/bad-options.json"),
      join(fixtures, "snapshots/ops-server.json"),
    ]);
    assert.equal(code, 2);
    assert.match(stderr, /Invalid options for rule "tool-budget"/);
  });

  it("lists rules", () => {
    const { stdout } = run(["rules"]);
    assert.match(stdout, /MCS001 {2}tool-budget/);
  });
});
