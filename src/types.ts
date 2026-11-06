/**
 * Core types. The manifest is the contract between loaders and rules: every
 * loader (snapshot file today, live server and source analysis later) produces
 * a Manifest, and rules only ever see a Manifest.
 */

export type JsonObject = { [key: string]: unknown };

export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface Tool {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: JsonObject;
  outputSchema?: JsonObject;
  annotations?: ToolAnnotations;
}

export interface Resource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceTemplate {
  uriTemplate: string;
  name?: string;
  description?: string;
}

export interface Prompt {
  name: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
}

export interface ManifestSource {
  /** Path of the file the manifest was loaded from. */
  path: string;
  /** Raw file text, used to map JSON pointers to line/column. */
  text: string;
  /** Detected input shape. */
  format: "snapshot" | "tools-list" | "jsonrpc";
  /** JSON pointer to the tools array inside the file (e.g. "/tools"). */
  toolsPointer: string;
}

export interface Manifest {
  /** Stable identifier for the server (snapshot id, else server name, else file name). */
  id: string;
  server: { name?: string; version?: string };
  instructions?: string;
  capabilities?: JsonObject;
  tools: Tool[];
  resources: Resource[];
  resourceTemplates: ResourceTemplate[];
  prompts: Prompt[];
  source: ManifestSource;
}

export type Severity = "error" | "warning";
export type SeverityLevel = "off" | "warn" | "error" | 0 | 1 | 2;
export type RuleEntry = SeverityLevel | [SeverityLevel, ...unknown[]];

export interface Position {
  line: number;
  column: number;
}

export interface Diagnostic {
  ruleId: string;
  code: string;
  severity: Severity;
  message: string;
  messageId: string;
  file: string;
  serverId: string;
  /** JSON pointer into the source file. */
  pointer: string;
  /** Logical location, independent of array order: e.g. "tool:pull_request_read/inputSchema/properties/method". */
  logicalLocation: string;
  start: Position;
  end: Position;
  /** Stable hash used for baselines and SARIF partialFingerprints. */
  fingerprint: string;
}

export interface LintResult {
  file: string;
  serverId: string;
  diagnostics: Diagnostic[];
  /** Diagnostics hidden by the baseline. */
  suppressed: Diagnostic[];
  errorCount: number;
  warningCount: number;
  /** Set when the file could not be loaded or holds no server data. */
  fatal?: string;
}
