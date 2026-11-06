/**
 * The engine: validates rule options, runs rule visitors over a manifest, and
 * turns reports into diagnostics with source positions and fingerprints.
 */
import { createHash } from "node:crypto";
import { Ajv, type ValidateFunction } from "ajv";
import { findNodeAtLocation, parseTree, type Node } from "jsonc-parser";
import type { ResolvedRule } from "./config.js";
import type { ReportDescriptor, Rule, RuleContext, RuleVisitor } from "./rule.js";
import type { Diagnostic, JsonObject, Manifest, Position } from "./types.js";

export class RuleOptionsError extends Error {}

const ajv = new Ajv({ allErrors: true, useDefaults: true, strict: true });
const validators = new WeakMap<Rule, ValidateFunction>();

/** Validate options against meta.schema, merged over meta.defaultOptions. */
export function ruleOptions(rule: Rule, options: JsonObject = {}): JsonObject {
  const merged = { ...structuredClone(rule.meta.defaultOptions ?? {}), ...options };
  const schema = rule.meta.schema ?? { type: "object", maxProperties: 0 };
  let validate = validators.get(rule);
  if (validate === undefined) {
    validate = ajv.compile(schema);
    validators.set(rule, validate);
  }
  if (!validate(merged)) {
    const details = (validate.errors ?? [])
      .map((e) => `${e.instancePath || "options"} ${e.message ?? "is invalid"}`)
      .join("; ");
    throw new RuleOptionsError(`Invalid options for rule "${rule.meta.id}": ${details}`);
  }
  return merged;
}

export function formatMessage(
  template: string,
  data: Record<string, string | number> = {},
): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in data ? String(data[key]) : match,
  );
}

function pointerSegments(pointer: string): (string | number)[] {
  if (pointer === "" || pointer === "/") return [];
  return pointer
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

class PositionMap {
  private readonly tree: Node | undefined;
  private readonly lineStarts: number[] = [0];

  constructor(private readonly text: string) {
    this.tree = parseTree(text);
    for (let i = 0; i < text.length; i++) if (text[i] === "\n") this.lineStarts.push(i + 1);
  }

  private position(offset: number): Position {
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if ((this.lineStarts[mid] as number) <= offset) low = mid;
      else high = mid - 1;
    }
    return { line: low + 1, column: offset - (this.lineStarts[low] as number) + 1 };
  }

  /** Range of the deepest existing node along the pointer. */
  range(pointer: string): { start: Position; end: Position } {
    const segments = pointerSegments(pointer);
    let node: Node | undefined;
    for (let n = segments.length; n >= 0 && node === undefined; n--) {
      node = this.tree ? findNodeAtLocation(this.tree, segments.slice(0, n)) : undefined;
    }
    // Point at the property key when the node is a property value.
    const target = node?.parent?.type === "property" ? node.parent : node;
    const offset = target?.offset ?? 0;
    const length = target?.length ?? Math.min(1, this.text.length);
    return { start: this.position(offset), end: this.position(offset + length) };
  }
}

export function fingerprint(
  ruleId: string,
  serverId: string,
  logical: string,
  messageId: string,
): string {
  return createHash("sha256")
    .update([ruleId, serverId, logical, messageId].join("\0"))
    .digest("hex")
    .slice(0, 32);
}

/** Run the given rules over one manifest. */
export function lintManifest(manifest: Manifest, rules: readonly ResolvedRule[]): Diagnostic[] {
  const positions = new PositionMap(manifest.source.text);
  const base = manifest.source.toolsPointer.replace(/\/tools$/, "");
  const diagnostics: Diagnostic[] = [];
  const visitors: RuleVisitor[] = [];

  for (const { rule, severity, options } of rules) {
    const validated = ruleOptions(rule, options);
    const context: RuleContext = {
      id: rule.meta.id,
      options: validated,
      manifest,
      report(descriptor: ReportDescriptor) {
        const template = rule.meta.messages[descriptor.messageId];
        if (template === undefined) {
          throw new Error(
            `Rule "${rule.meta.id}" reported unknown messageId "${descriptor.messageId}"`,
          );
        }
        const path = descriptor.path ?? "";
        let pointer = `${base}${path}`;
        let logical = `server${path}`;
        if (descriptor.tool !== undefined) {
          pointer = `${base}/tools/${descriptor.tool}${path}`;
          logical = `tool:${manifest.tools[descriptor.tool]?.name ?? descriptor.tool}${path}`;
        } else if (descriptor.resource !== undefined) {
          pointer = `${base}/resources/${descriptor.resource}${path}`;
          logical = `resource:${manifest.resources[descriptor.resource]?.uri ?? descriptor.resource}${path}`;
        } else if (descriptor.prompt !== undefined) {
          pointer = `${base}/prompts/${descriptor.prompt}${path}`;
          logical = `prompt:${manifest.prompts[descriptor.prompt]?.name ?? descriptor.prompt}${path}`;
        }
        diagnostics.push({
          ruleId: rule.meta.id,
          code: rule.meta.code,
          severity: severity === "error" ? "error" : "warning",
          message: formatMessage(template, descriptor.data),
          messageId: descriptor.messageId,
          file: manifest.source.path,
          serverId: manifest.id,
          pointer,
          logicalLocation: logical,
          ...positions.range(pointer),
          fingerprint: fingerprint(rule.meta.id, manifest.id, logical, descriptor.messageId),
        });
      },
    };
    visitors.push(rule.create(context));
  }

  for (const v of visitors) v.server?.(manifest);
  manifest.tools.forEach((tool, i) => visitors.forEach((v) => v.tool?.(tool, i)));
  manifest.resources.forEach((r, i) => visitors.forEach((v) => v.resource?.(r, i)));
  manifest.prompts.forEach((p, i) => visitors.forEach((v) => v.prompt?.(p, i)));
  for (const v of visitors) v["server:exit"]?.(manifest);

  return diagnostics.sort(
    (a, b) =>
      a.start.line - b.start.line ||
      a.start.column - b.start.column ||
      a.code.localeCompare(b.code),
  );
}
