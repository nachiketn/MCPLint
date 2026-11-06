/** Helpers shared by rules: schema walking, name tokenizing, operation detection. */
import type { JsonObject, Tool } from "../types.js";

export function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Escape one JSON pointer segment (RFC 6901). */
export function escapePointer(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

export interface PropertyInfo {
  name: string;
  schema: JsonObject;
  /** Pointer relative to the tool. */
  path: string;
  required: boolean;
}

/** Top-level properties of a tool's input schema. */
export function toolProperties(tool: Tool): PropertyInfo[] {
  const schema = tool.inputSchema;
  if (!isObject(schema) || !isObject(schema.properties)) return [];
  const required = new Set(
    Array.isArray(schema.required) ? schema.required.filter((r) => typeof r === "string") : [],
  );
  return Object.entries(schema.properties)
    .filter((entry): entry is [string, JsonObject] => isObject(entry[1]))
    .map(([name, propSchema]) => ({
      name,
      schema: propSchema,
      path: `/inputSchema/properties/${escapePointer(name)}`,
      required: required.has(name),
    }));
}

/** Literal values a property schema allows: enum, const, or a oneOf/anyOf of consts. */
export function literalValues(schema: JsonObject): string[] | undefined {
  if (Array.isArray(schema.enum)) return schema.enum.map(String);
  if (schema.const !== undefined) return [String(schema.const)];
  for (const key of ["oneOf", "anyOf"] as const) {
    const branches = schema[key];
    if (Array.isArray(branches) && branches.length > 0) {
      const values: string[] = [];
      for (const branch of branches) {
        if (!isObject(branch)) return undefined;
        const inner = literalValues(branch);
        if (inner === undefined) return undefined;
        values.push(...inner);
      }
      return values;
    }
  }
  if (isObject(schema.items)) return literalValues(schema.items);
  return undefined;
}

/**
 * Discriminated unions (what zod's discriminatedUnion emits): the input schema
 * is a oneOf/anyOf whose branches each fix one property to a const.
 * Returns the discriminator name and its values.
 */
export function discriminator(
  tool: Tool,
): { name: string; values: string[]; path: string } | undefined {
  const schema = tool.inputSchema;
  if (!isObject(schema)) return undefined;
  for (const key of ["oneOf", "anyOf"] as const) {
    const branches = schema[key];
    if (!Array.isArray(branches) || branches.length < 2) continue;
    let candidates: Set<string> | undefined;
    const valuesByProp = new Map<string, string[]>();
    for (const branch of branches) {
      if (!isObject(branch) || !isObject(branch.properties)) return undefined;
      const consts = new Set<string>();
      for (const [prop, propSchema] of Object.entries(branch.properties)) {
        if (!isObject(propSchema)) continue;
        const values = literalValues(propSchema);
        if (values?.length === 1) {
          consts.add(prop);
          valuesByProp.set(prop, [...(valuesByProp.get(prop) ?? []), values[0] as string]);
        }
      }
      candidates =
        candidates === undefined ? consts : new Set([...candidates].filter((c) => consts.has(c)));
    }
    const name = candidates?.values().next().value;
    if (name !== undefined) {
      return { name, values: valuesByProp.get(name) ?? [], path: `/inputSchema/${key}` };
    }
  }
  return undefined;
}

/** Split an identifier or sentence into lowercase words. */
export function words(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export const DEFAULT_SELECTOR_NAMES = [
  "method",
  "action",
  "operation",
  "op",
  "command",
  "cmd",
  "mode",
  "subcommand",
  "verb",
  "intent",
  "function",
];

export interface DispatchInfo {
  selector: string;
  operations: string[];
  /** Pointer relative to the tool. */
  path: string;
}

/**
 * Detects a tool that selects among several operations through one argument
 * (the God Tool shape): a property with a selector-like name whose allowed
 * values are a closed set of at least `minOperations` entries.
 */
export function findDispatch(
  tool: Tool,
  minOperations: number,
  selectorNames: readonly string[] = DEFAULT_SELECTOR_NAMES,
): DispatchInfo | undefined {
  const selectors = new Set(selectorNames.map((n) => n.toLowerCase()));
  const isSelector = (name: string) =>
    selectors.has(name.toLowerCase()) || words(name).some((w) => selectors.has(w));

  for (const prop of toolProperties(tool)) {
    if (!isSelector(prop.name)) continue;
    const values = literalValues(prop.schema);
    if (values !== undefined && new Set(values).size >= minOperations) {
      return { selector: prop.name, operations: [...new Set(values)], path: prop.path };
    }
  }
  const union = discriminator(tool);
  if (union !== undefined && new Set(union.values).size >= minOperations) {
    return { selector: union.name, operations: [...new Set(union.values)], path: union.path };
  }
  return undefined;
}

const READ_VERBS = new Set([
  "get",
  "list",
  "read",
  "search",
  "describe",
  "show",
  "view",
  "fetch",
  "query",
  "count",
  "find",
  "status",
  "diff",
  "log",
  "logs",
  "inspect",
  "info",
  "check",
]);

const WRITE_VERBS = new Set([
  "create",
  "update",
  "delete",
  "remove",
  "put",
  "post",
  "patch",
  "write",
  "set",
  "add",
  "merge",
  "close",
  "cancel",
  "kill",
  "apply",
  "exec",
  "execute",
  "run",
  "deploy",
  "drop",
  "insert",
  "upload",
  "move",
  "rename",
  "edit",
  "assign",
  "approve",
  "reject",
  "submit",
  "push",
  "reset",
  "restart",
  "scale",
  "start",
  "stop",
]);

export type OperationKind = "read" | "write" | "unknown";

/** Classify an operation name by its leading verb (first word, or any word for get_x). */
export function operationKind(operation: string): OperationKind {
  const ws = words(operation);
  for (const w of ws) {
    if (WRITE_VERBS.has(w)) return "write";
    if (READ_VERBS.has(w)) return "read";
  }
  return "unknown";
}

export function sample(values: readonly string[], max = 4): string {
  const shown = values.slice(0, max).join(", ");
  return values.length > max ? `${shown}, …` : shown;
}
