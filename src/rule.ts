/**
 * Rule API, modelled on ESLint's: a rule is `{ meta, create(context) }`, where
 * `create` returns visitor callbacks and reports through `context.report` using
 * message ids. Options are validated against `meta.schema` (JSON Schema, as in
 * ESLint) before `create` is called, with `meta.defaultOptions` merged in.
 *
 * Codes follow Ruff/Clippy: a stable short code per rule (MCS201) next to a
 * readable id (god-tool-dispatch), grouped by hundreds:
 *   0xx server surface, 1xx descriptions, 2xx God Tool, 3xx annotations,
 *   4xx naming, 5xx security signals.
 */
import type { JsonObject, Manifest, Prompt, Resource, Tool } from "./types.js";

export type RuleCategory =
  "surface" | "descriptions" | "god-tool" | "annotations" | "naming" | "security";

export interface RuleMeta {
  /** Readable id, kebab-case. Used in config and output. */
  id: string;
  /** Stable short code (Ruff-style). Accepted in config too. */
  code: string;
  /** ESLint semantics: "problem" = likely defect, "suggestion" = design smell. */
  type: "problem" | "suggestion";
  category: RuleCategory;
  /** "preview" rules run only with preview mode on (Ruff semantics). */
  stability: "stable" | "preview";
  /** Part of the `mcpsmell:recommended` preset. */
  recommended: boolean;
  /** Severity when enabled through a preset. */
  defaultSeverity: "warn" | "error";
  docs: {
    description: string;
    /** Where the rule comes from: paper, section, or prior tool. */
    source: string;
    /** Longer explanation, rendered in docs/rules.md. */
    rationale: string;
  };
  /** Message templates keyed by messageId, with {{placeholders}}. */
  messages: Record<string, string>;
  /** JSON Schema for the single options object. */
  schema?: JsonObject;
  defaultOptions?: JsonObject;
}

export interface ReportDescriptor {
  messageId: string;
  data?: Record<string, string | number>;
  /** Index into manifest.tools / resources / prompts, if the finding is about one. */
  tool?: number;
  resource?: number;
  prompt?: number;
  /** JSON pointer relative to the tool/resource/prompt (or to the server when none is given). */
  path?: string;
}

export interface RuleContext<O extends JsonObject = JsonObject> {
  readonly id: string;
  readonly options: O;
  readonly manifest: Manifest;
  report(descriptor: ReportDescriptor): void;
}

export interface RuleVisitor {
  server?(manifest: Manifest): void;
  tool?(tool: Tool, index: number): void;
  resource?(resource: Resource, index: number): void;
  prompt?(prompt: Prompt, index: number): void;
  "server:exit"?(manifest: Manifest): void;
}

export interface Rule<O extends JsonObject = JsonObject> {
  meta: RuleMeta;
  create(context: RuleContext<O>): RuleVisitor;
}

/** Identity helper that gives rule authors type checking for options. */
export function defineRule<O extends JsonObject>(rule: Rule<O>): Rule<O> {
  return rule;
}
