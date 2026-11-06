/**
 * Flat config, following ESLint's flat config: a config is an array of
 * objects merged in order, later entries winning. Presets are referenced by
 * name ("mcpsmell:recommended", "mcpsmell:all") or spread from the exported
 * `configs` object in JS configs.
 *
 *   // mcpsmell.config.mjs
 *   import { configs } from "mcpsmell";
 *   export default [
 *     configs.recommended,
 *     { rules: { "tool-budget": ["error", { max: 20 }], MCS103: "off" } },
 *     { servers: ["github*"], rules: { "god-tool-dispatch": "off" } },
 *   ];
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Rule } from "./rule.js";
import { builtinRules } from "./rules/index.js";
import type { JsonObject, RuleEntry, SeverityLevel } from "./types.js";

export interface ConfigObject {
  name?: string;
  /** Server ids this object applies to; `*` wildcards. Omitted = all servers. */
  servers?: string[];
  rules?: Record<string, RuleEntry>;
  linterOptions?: {
    /** Enable preview rules (Ruff semantics). */
    preview?: boolean;
  };
}

export type ConfigItem = ConfigObject | `mcpsmell:${"recommended" | "all"}`;
export type FlatConfig = ConfigItem[];

export class ConfigError extends Error {}

function presetFrom(name: string, filter: (rule: Rule) => boolean): ConfigObject {
  return {
    name,
    rules: Object.fromEntries(
      builtinRules.filter(filter).map((rule) => [rule.meta.id, rule.meta.defaultSeverity]),
    ),
  };
}

export const configs = {
  recommended: presetFrom("mcpsmell:recommended", (rule) => rule.meta.recommended),
  /** Every rule. Preview rules in it still need preview mode. */
  all: presetFrom("mcpsmell:all", () => true),
} as const;

export const CONFIG_FILES = ["mcpsmell.config.mjs", "mcpsmell.config.js", "mcpsmell.config.json"];

export interface ResolvedRule {
  rule: Rule;
  severity: "warn" | "error";
  options: JsonObject;
}

const rulesByKey = new Map<string, Rule>(
  builtinRules.flatMap((rule) => [
    [rule.meta.id, rule],
    [rule.meta.code, rule],
  ]),
);

export function findRule(key: string): Rule | undefined {
  return rulesByKey.get(key) ?? rulesByKey.get(key.toUpperCase());
}

function normalizeSeverity(level: unknown, where: string): "off" | "warn" | "error" {
  switch (level as SeverityLevel) {
    case "off":
    case 0:
      return "off";
    case "warn":
    case 1:
      return "warn";
    case "error":
    case 2:
      return "error";
    default:
      throw new ConfigError(`${where}: severity must be "off", "warn", "error", 0, 1 or 2`);
  }
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\?]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function expand(item: ConfigItem, index: number): ConfigObject {
  if (typeof item === "string") {
    if (item === "mcpsmell:recommended") return configs.recommended;
    if (item === "mcpsmell:all") return configs.all;
    throw new ConfigError(`Config entry ${index}: unknown preset "${item}"`);
  }
  if (typeof item !== "object" || item === null || Array.isArray(item)) {
    throw new ConfigError(`Config entry ${index}: expected an object or a preset name`);
  }
  return item;
}

export interface ResolveOptions {
  /** CLI --preview: overrides linterOptions.preview. */
  preview?: boolean;
  /** CLI --rule overrides, applied last. */
  ruleOverrides?: Record<string, RuleEntry>;
  /** Collects non-fatal messages (e.g. a preview rule enabled without preview mode). */
  warnings?: string[];
}

/** Compute the enabled rules for one server. */
export function resolveRules(
  config: FlatConfig,
  serverId: string,
  options: ResolveOptions = {},
): ResolvedRule[] {
  const entries = new Map<Rule, { severity: "off" | "warn" | "error"; options?: JsonObject }>();
  let preview = false;
  const objects = config.map(expand);
  if (options.ruleOverrides) objects.push({ name: "--rule", rules: options.ruleOverrides });

  objects.forEach((object, index) => {
    if (object.servers && !object.servers.some((glob) => globToRegExp(glob).test(serverId))) {
      return;
    }
    if (object.linterOptions?.preview !== undefined) preview = object.linterOptions.preview;
    for (const [key, entry] of Object.entries(object.rules ?? {})) {
      const where = `${object.name ?? `config entry ${index}`}, rule "${key}"`;
      const rule = findRule(key);
      if (rule === undefined) throw new ConfigError(`${where}: unknown rule`);
      const [level, ruleOptions] = Array.isArray(entry) ? entry : [entry];
      const previous = entries.get(rule);
      const next: { severity: "off" | "warn" | "error"; options?: JsonObject } = {
        severity: normalizeSeverity(level, where),
      };
      // ESLint semantics: a bare severity keeps previously configured options.
      const opts =
        Array.isArray(entry) && entry.length > 1 ? (ruleOptions as JsonObject) : previous?.options;
      if (opts !== undefined) next.options = opts;
      entries.set(rule, next);
    }
  });
  if (options.preview !== undefined) preview = options.preview;

  const resolved: ResolvedRule[] = [];
  for (const [rule, entry] of entries) {
    if (entry.severity === "off") continue;
    if (rule.meta.stability === "preview" && !preview) {
      options.warnings?.push(
        `Rule ${rule.meta.code} (${rule.meta.id}) is a preview rule and is skipped; run with --preview to enable it.`,
      );
      continue;
    }
    resolved.push({ rule, severity: entry.severity, options: entry.options ?? {} });
  }
  return resolved.sort((a, b) => a.rule.meta.code.localeCompare(b.rule.meta.code));
}

/** Load a config file, or the first default config file in `cwd`. */
export async function loadConfig(path: string | undefined, cwd: string): Promise<FlatConfig> {
  const file = path
    ? resolve(cwd, path)
    : CONFIG_FILES.map((f) => resolve(cwd, f)).find(existsSync);
  if (file === undefined) return ["mcpsmell:recommended"];
  if (!existsSync(file)) throw new ConfigError(`Config file not found: ${file}`);

  let value: unknown;
  try {
    if (file.endsWith(".json")) {
      value = JSON.parse(await readFile(file, "utf8"));
    } else {
      value = ((await import(pathToFileURL(file).href)) as { default?: unknown }).default;
    }
  } catch (error) {
    throw new ConfigError(`Could not load ${file}: ${(error as Error).message}`);
  }
  if (!Array.isArray(value)) {
    throw new ConfigError(`${file}: the config must be an array (flat config)`);
  }
  return value as FlatConfig;
}
