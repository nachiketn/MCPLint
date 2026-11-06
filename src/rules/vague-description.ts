import { defineRule } from "../rule.js";
import { words } from "./util.js";

const FILLER = new Set([
  "a",
  "an",
  "the",
  "of",
  "for",
  "to",
  "in",
  "on",
  "and",
  "or",
  "all",
  "this",
  "tool",
  "tools",
  "with",
  "by",
  "from",
  "it",
  "s",
]);

export default defineRule<{ minWords: number }>({
  meta: {
    id: "vague-description",
    code: "MCS102",
    type: "suggestion",
    category: "descriptions",
    stability: "stable",
    recommended: true,
    defaultSeverity: "warn",
    docs: {
      description: "Tool descriptions should say more than the tool name.",
      source: "Rodrigues & Vas, ICSME 2026: Missing/Vague Descriptions anti-pattern",
      rationale:
        'A description that only restates the name (list_gateways: "List Gateways") or is a couple of words long gives the model nothing to choose with: no scope, no inputs, no when-to-use. The rule flags descriptions under `minWords` words and descriptions whose words, ignoring filler, all come from the tool name.',
    },
    messages: {
      tooShort:
        "Tool '{{tool}}' has a {{count}}-word description. Say what it returns and when to use it.",
      restatesName:
        "Tool '{{tool}}' description only restates its name. Say what it returns and when to use it.",
    },
    schema: {
      type: "object",
      properties: { minWords: { type: "integer", minimum: 1 } },
      additionalProperties: false,
    },
    defaultOptions: { minWords: 4 },
  },
  create(context) {
    return {
      tool(tool, index) {
        const description = tool.description?.trim();
        if (!description) return; // missing-description covers this
        const descWords = words(description);
        const nameWords = new Set([...words(tool.name), ...words(tool.title ?? "")]);
        const meaningful = descWords.filter((w) => !FILLER.has(w));
        if (meaningful.length > 0 && meaningful.every((w) => nameWords.has(w))) {
          context.report({
            messageId: "restatesName",
            data: { tool: tool.name },
            tool: index,
            path: "/description",
          });
        } else if (descWords.length < context.options.minWords) {
          context.report({
            messageId: "tooShort",
            data: { tool: tool.name, count: descWords.length },
            tool: index,
            path: "/description",
          });
        }
      },
    };
  },
});
