/**
 * RuleTester, after ESLint's: declare valid and invalid cases for a rule and
 * get one test per case. Cases are partial server snapshots (usually just
 * `{ tools: [...] }`), so rule tests read like the data rules see.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lintManifest } from "../linter.js";
import { manifestFromJson } from "../loaders/snapshot.js";
import type { Rule } from "../rule.js";
import type { JsonObject } from "../types.js";

export interface TestServer {
  tools?: JsonObject[];
  resources?: JsonObject[];
  prompts?: JsonObject[];
  [key: string]: unknown;
}

export interface ValidCase {
  name?: string;
  server: TestServer;
  options?: JsonObject;
}

export interface ExpectedError {
  messageId: string;
  /** Expected message after interpolation (optional). */
  message?: string;
  /** Expected JSON pointer (optional). */
  pointer?: string;
}

export interface InvalidCase extends ValidCase {
  errors: ExpectedError[];
}

function run(rule: Rule, testCase: ValidCase) {
  const server = { tools: [], ...testCase.server };
  const manifest = manifestFromJson("test.json", JSON.stringify(server, null, 2));
  return lintManifest(manifest, [{ rule, severity: "warn", options: testCase.options ?? {} }]);
}

function label(testCase: ValidCase, index: number): string {
  if (testCase.name) return testCase.name;
  const names = (testCase.server.tools ?? []).map((t) => String(t.name)).join(", ");
  return `#${index + 1}${names ? ` (${names})` : ""}`;
}

export class RuleTester {
  run(rule: Rule, tests: { valid: ValidCase[]; invalid: InvalidCase[] }): void {
    for (const id of Object.keys(rule.meta.messages)) {
      assert.match(id, /^[a-zA-Z]+$/, `messageId "${id}" should be camelCase`);
    }
    describe(`${rule.meta.code} ${rule.meta.id}`, () => {
      describe("valid", () => {
        tests.valid.forEach((testCase, i) => {
          it(label(testCase, i), () => {
            const found = run(rule, testCase);
            assert.deepEqual(
              found.map((d) => d.message),
              [],
              "Expected no findings",
            );
          });
        });
      });
      describe("invalid", () => {
        tests.invalid.forEach((testCase, i) => {
          it(label(testCase, i), () => {
            const found = run(rule, testCase);
            assert.equal(
              found.length,
              testCase.errors.length,
              `Expected ${testCase.errors.length} finding(s), got ${found.length}: ${JSON.stringify(found.map((d) => d.message))}`,
            );
            testCase.errors.forEach((expected, j) => {
              const actual = found[j];
              assert.ok(actual);
              assert.equal(actual.messageId, expected.messageId);
              if (expected.message !== undefined) assert.equal(actual.message, expected.message);
              if (expected.pointer !== undefined) assert.equal(actual.pointer, expected.pointer);
              assert.doesNotMatch(actual.message, /\{\{/, "Unfilled placeholder in message");
            });
          });
        });
      });
    });
  }
}
