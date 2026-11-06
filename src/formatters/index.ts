import type { LintResult } from "../types.js";
import json from "./json.js";
import sarif from "./sarif.js";
import stylish from "./stylish.js";

export type Formatter = (results: readonly LintResult[]) => string;

export const formatters: Record<string, Formatter> = { stylish, json, sarif };
