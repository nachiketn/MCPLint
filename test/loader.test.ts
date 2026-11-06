import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LoadError, manifestFromJson } from "../src/loaders/snapshot.js";

describe("snapshot loader", () => {
  it("reads collector snapshots", () => {
    const m = manifestFromJson(
      "x.json",
      JSON.stringify({
        id: "git",
        serverInfo: { name: "mcp-git", version: "1.0" },
        tools: [{ name: "a" }],
      }),
    );
    assert.equal(m.id, "git");
    assert.deepEqual(m.server, { name: "mcp-git", version: "1.0" });
    assert.equal(m.source.format, "snapshot");
  });

  it("reads bare tools/list results and names them after the file", () => {
    const m = manifestFromJson("/tmp/fetch.json", JSON.stringify({ tools: [] }));
    assert.equal(m.id, "fetch");
    assert.equal(m.source.format, "tools-list");
  });

  it("reads JSON-RPC responses", () => {
    const m = manifestFromJson(
      "r.json",
      JSON.stringify({ jsonrpc: "2.0", id: 1, result: { tools: [{ name: "p" }] } }),
    );
    assert.equal(m.source.toolsPointer, "/result/tools");
    assert.equal(m.tools.length, 1);
  });

  it("fails clearly on bad input", () => {
    assert.throws(() => manifestFromJson("a.json", "{"), LoadError);
    assert.throws(() => manifestFromJson("a.json", "[]"), LoadError);
    assert.throws(
      () => manifestFromJson("a.json", JSON.stringify({ id: "x", error: "boom" })),
      /boom/,
    );
  });
});
