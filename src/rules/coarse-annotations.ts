import { defineRule } from "../rule.js";
import { DEFAULT_SELECTOR_NAMES, findDispatch, operationKind, sample } from "./util.js";

export default defineRule<{ minOperations: number }>({
  meta: {
    id: "coarse-annotations",
    code: "MCS301",
    type: "problem",
    category: "annotations",
    stability: "stable",
    recommended: true,
    defaultSeverity: "warn",
    docs: {
      description:
        "A tool that mixes read and write operations cannot carry accurate safety annotations.",
      source:
        "MCP spec tool annotations (readOnlyHint, destructiveHint); mcpsmell pilot finding on God Tools",
      rationale:
        "Clients use readOnlyHint and destructiveHint to decide when to ask the user for approval. Annotations apply to the whole tool, so a dispatch tool that both lists and deletes must either claim to be read-only (unsafe: writes skip approval) or destructive (noisy: every read asks for approval). The rule reports a mixed dispatch tool as a problem when it claims readOnlyHint: true, and as a coarse annotation otherwise.",
    },
    messages: {
      readOnlyOnWrites:
        "Tool '{{tool}}' is annotated readOnlyHint: true but its '{{selector}}' includes writes ({{writes}}). Clients may skip approval for them.",
      coarse:
        "Tool '{{tool}}' mixes read ({{reads}}) and write ({{writes}}) operations, so one set of annotations cannot describe it. Split reads from writes.",
    },
    schema: {
      type: "object",
      properties: { minOperations: { type: "integer", minimum: 2 } },
      additionalProperties: false,
    },
    defaultOptions: { minOperations: 2 },
  },
  create(context) {
    return {
      tool(tool, index) {
        const dispatch = findDispatch(tool, context.options.minOperations, DEFAULT_SELECTOR_NAMES);
        if (dispatch === undefined) return;
        const reads = dispatch.operations.filter((op) => operationKind(op) === "read");
        const writes = dispatch.operations.filter((op) => operationKind(op) === "write");
        if (reads.length === 0 || writes.length === 0) return;
        const readOnly = tool.annotations?.readOnlyHint === true;
        context.report({
          messageId: readOnly ? "readOnlyOnWrites" : "coarse",
          data: {
            tool: tool.name,
            selector: dispatch.selector,
            reads: sample(reads, 3),
            writes: sample(writes, 3),
          },
          tool: index,
          path: readOnly ? "/annotations/readOnlyHint" : dispatch.path,
        });
      },
    };
  },
});
