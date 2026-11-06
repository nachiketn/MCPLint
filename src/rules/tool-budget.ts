import { defineRule } from "../rule.js";

export default defineRule<{ max: number }>({
  meta: {
    id: "tool-budget",
    code: "MCS001",
    type: "suggestion",
    category: "surface",
    stability: "stable",
    recommended: true,
    defaultSeverity: "warn",
    docs: {
      description: "Limit the number of tools a server exposes in its default configuration.",
      source: "Rodrigues & Vas, ICSME 2026: tool budget of about 10-15 tools per server",
      rationale:
        "Every tool definition is sent to the model on every turn. Past roughly 15 tools, tool-selection accuracy drops and context cost grows. Servers that need more capability should split into focused servers or expose toolsets that clients enable on demand. The rule counts the tools the snapshot saw, so snapshot the default configuration to measure what users get out of the box.",
    },
    messages: {
      overBudget:
        "Server exposes {{count}} tools, over the budget of {{max}}. Split it into focused servers or ship smaller default toolsets.",
    },
    schema: {
      type: "object",
      properties: { max: { type: "integer", minimum: 1 } },
      additionalProperties: false,
    },
    defaultOptions: { max: 15 },
  },
  create(context) {
    return {
      server(manifest) {
        const count = manifest.tools.length;
        if (count > context.options.max) {
          context.report({
            messageId: "overBudget",
            data: { count, max: context.options.max },
            path: "/tools",
          });
        }
      },
    };
  },
});
