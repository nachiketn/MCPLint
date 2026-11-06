import { defineRule } from "../rule.js";

export default defineRule({
  meta: {
    id: "missing-description",
    code: "MCS101",
    type: "problem",
    category: "descriptions",
    stability: "stable",
    recommended: true,
    defaultSeverity: "error",
    docs: {
      description: "Every tool needs a description.",
      source: "Rodrigues & Vas, ICSME 2026: Missing/Vague Descriptions anti-pattern",
      rationale:
        "The description is the only thing the model reads to decide whether to call a tool. A tool without one is chosen by name alone, which leads to wrong or missed calls.",
    },
    messages: {
      missing: "Tool '{{tool}}' has no description.",
    },
  },
  create(context) {
    return {
      tool(tool, index) {
        if (typeof tool.description !== "string" || tool.description.trim() === "") {
          context.report({ messageId: "missing", data: { tool: tool.name }, tool: index });
        }
      },
    };
  },
});
