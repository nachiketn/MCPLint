import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configs, ConfigError, resolveRules } from "../src/config.js";
import { builtinRules } from "../src/rules/index.js";

const ids = (config: Parameters<typeof resolveRules>[0], server = "srv", preview?: boolean) =>
  resolveRules(config, server, preview === undefined ? {} : { preview }).map((r) => r.rule.meta.id);

describe("config", () => {
  it("recommended contains only stable recommended rules", () => {
    for (const rule of builtinRules) {
      assert.equal(rule.meta.id in (configs.recommended.rules ?? {}), rule.meta.recommended);
      if (rule.meta.recommended) assert.equal(rule.meta.stability, "stable");
    }
  });

  it("later entries win and a bare severity keeps earlier options", () => {
    const resolved = resolveRules(
      [{ rules: { "tool-budget": ["warn", { max: 3 }] } }, { rules: { MCS001: "error" } }],
      "srv",
    );
    assert.equal(resolved[0]?.severity, "error");
    assert.deepEqual(resolved[0]?.options, { max: 3 });
  });

  it("scopes entries to servers by glob", () => {
    const config = [
      "mcpsmell:recommended" as const,
      { servers: ["github*"], rules: { "god-tool-dispatch": "off" as const } },
    ];
    assert.ok(ids(config, "filesystem").includes("god-tool-dispatch"));
    assert.ok(!ids(config, "github-all").includes("god-tool-dispatch"));
  });

  it("runs preview rules only in preview mode", () => {
    assert.ok(!ids(["mcpsmell:all"]).includes("hidden-instructions"));
    assert.ok(ids(["mcpsmell:all"], "srv", true).includes("hidden-instructions"));
    assert.ok(
      ids([{ linterOptions: { preview: true } }, "mcpsmell:all"]).includes("hidden-instructions"),
    );
  });

  it("rejects unknown rules and severities", () => {
    assert.throws(() => resolveRules([{ rules: { nope: "warn" } }], "srv"), ConfigError);
    assert.throws(() => resolveRules([{ rules: { MCS001: "loud" as never } }], "srv"), ConfigError);
  });

  it("every rule has unique id and code and documented messages", () => {
    assert.equal(new Set(builtinRules.map((r) => r.meta.id)).size, builtinRules.length);
    assert.equal(new Set(builtinRules.map((r) => r.meta.code)).size, builtinRules.length);
    for (const rule of builtinRules) {
      assert.match(rule.meta.code, /^MCS\d{3}$/);
      assert.match(rule.meta.id, /^[a-z]+(-[a-z]+)*$/);
      assert.ok(Object.keys(rule.meta.messages).length > 0);
    }
  });
});
