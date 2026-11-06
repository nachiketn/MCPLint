import { readFileSync } from "node:fs";

/** Package version, read from package.json (dist/src/version.js -> ../../package.json). */
export const VERSION: string = (
  JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
    version: string;
  }
).version;

export const HOMEPAGE = "https://github.com/nachiketn/MCPLint";

export function ruleDocsUrl(id: string): string {
  return `${HOMEPAGE}/blob/main/docs/rules.md#${id}`;
}
