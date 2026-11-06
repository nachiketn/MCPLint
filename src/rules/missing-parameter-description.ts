import { defineRule } from "../rule.js";
import { literalValues, toolProperties } from "./util.js";

export default defineRule<{ ignore: string[]; ignoreEnums: boolean }>({
  meta: {
    id: "missing-parameter-description",
    code: "MCS103",
    type: "suggestion",
    category: "descriptions",
    stability: "stable",
    recommended: true,
    defaultSeverity: "warn",
    docs: {
      description: "Tool input properties should have descriptions.",
      source: "Rodrigues & Vas, ICSME 2026: Missing/Vague Descriptions anti-pattern",
      rationale:
        "Models fill arguments from the property name and description. Undescribed parameters lead to guessed formats (ids vs names, relative vs absolute paths). Enum-valued properties can be skipped with `ignoreEnums`, since the allowed values already document them.",
    },
    messages: {
      missing: "Parameter '{{param}}' of tool '{{tool}}' has no description.",
    },
    schema: {
      type: "object",
      properties: {
        ignore: { type: "array", items: { type: "string" } },
        ignoreEnums: { type: "boolean" },
      },
      additionalProperties: false,
    },
    defaultOptions: { ignore: [], ignoreEnums: false },
  },
  create(context) {
    const ignore = new Set(context.options.ignore);
    return {
      tool(tool, index) {
        for (const prop of toolProperties(tool)) {
          if (ignore.has(prop.name)) continue;
          const description = prop.schema.description ?? prop.schema.title;
          if (typeof description === "string" && description.trim() !== "") continue;
          if (context.options.ignoreEnums && literalValues(prop.schema) !== undefined) continue;
          context.report({
            messageId: "missing",
            data: { tool: tool.name, param: prop.name },
            tool: index,
            path: prop.path,
          });
        }
      },
    };
  },
});
