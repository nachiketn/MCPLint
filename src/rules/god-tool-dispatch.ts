import { defineRule } from "../rule.js";
import { DEFAULT_SELECTOR_NAMES, findDispatch, operationKind, sample } from "./util.js";

export default defineRule<{ minOperations: number; selectorNames: string[] }>({
  meta: {
    id: "god-tool-dispatch",
    code: "MCS201",
    type: "suggestion",
    category: "god-tool",
    stability: "stable",
    recommended: true,
    defaultSeverity: "warn",
    docs: {
      description: "Avoid tools that dispatch many operations through one selector argument.",
      source: "Rodrigues & Vas, ICSME 2026: God Tool anti-pattern",
      rationale:
        "A tool such as `pull_request_read(method: get | get_diff | get_files | ...)` hides several operations behind one name and one description. The model must pick the tool and then the right method, the description has to cover every operation, and annotations (readOnlyHint, destructiveHint) can only describe the riskiest one. The rule flags a selector-named property (method, action, operation, command, ...) or a discriminated union with at least `minOperations` allowed values. Vendors often consolidate on purpose to stay within a tool budget; if so, group operations by risk class (all reads in one tool, writes in another) rather than mixing them.",
    },
    messages: {
      dispatch:
        "Tool '{{tool}}' dispatches {{count}} operations through '{{selector}}' ({{operations}}). Split it into one tool per operation, or at least per risk class.",
      dispatchMixed:
        "Tool '{{tool}}' dispatches {{count}} operations through '{{selector}}', mixing reads and writes ({{operations}}). Split it at least by risk class.",
    },
    schema: {
      type: "object",
      properties: {
        minOperations: { type: "integer", minimum: 2 },
        selectorNames: { type: "array", items: { type: "string" }, minItems: 1 },
      },
      additionalProperties: false,
    },
    defaultOptions: { minOperations: 4, selectorNames: DEFAULT_SELECTOR_NAMES },
  },
  create(context) {
    return {
      tool(tool, index) {
        const dispatch = findDispatch(
          tool,
          context.options.minOperations,
          context.options.selectorNames,
        );
        if (dispatch === undefined) return;
        const kinds = new Set(dispatch.operations.map(operationKind));
        context.report({
          messageId: kinds.has("read") && kinds.has("write") ? "dispatchMixed" : "dispatch",
          data: {
            tool: tool.name,
            count: dispatch.operations.length,
            selector: dispatch.selector,
            operations: sample(dispatch.operations),
          },
          tool: index,
          path: dispatch.path,
        });
      },
    };
  },
});
