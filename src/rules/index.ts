import type { Rule } from "../rule.js";
import coarseAnnotations from "./coarse-annotations.js";
import godToolDispatch from "./god-tool-dispatch.js";
import godToolPassthrough from "./god-tool-passthrough.js";
import hiddenInstructions from "./hidden-instructions.js";
import missingDescription from "./missing-description.js";
import missingParameterDescription from "./missing-parameter-description.js";
import toolBudget from "./tool-budget.js";
import vagueDescription from "./vague-description.js";
import versionSuffixedName from "./version-suffixed-name.js";

/** Built-in rules, ordered by code. */
export const builtinRules: readonly Rule[] = [
  toolBudget,
  missingDescription,
  vagueDescription,
  missingParameterDescription,
  godToolDispatch,
  godToolPassthrough,
  coarseAnnotations,
  versionSuffixedName,
  hiddenInstructions,
] as Rule[];
