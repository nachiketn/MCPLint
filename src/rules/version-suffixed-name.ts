import { defineRule } from "../rule.js";

const VERSIONED = /(?:[_\-.]v\d+|[a-z]V\d+|[_\-.](?:new|old|legacy|deprecated))$/i;

export default defineRule({
  meta: {
    id: "version-suffixed-name",
    code: "MCS401",
    type: "suggestion",
    category: "naming",
    stability: "stable",
    recommended: true,
    defaultSeverity: "warn",
    docs: {
      description: "Do not version tools through their names (search_v2, get_items_new).",
      source: "Srinivasan, arXiv 2603.13417: version-suffixed tool names",
      rationale:
        "Models cannot tell which of search and search_v2 to use, and agents tend to call both. Versions belong in the server version reported in initialize; replace tools in place and remove the old one, or keep distinct names that say what differs.",
    },
    messages: {
      versioned: "Tool '{{tool}}' carries a version or age suffix in its name.",
    },
  },
  create(context) {
    return {
      tool(tool, index) {
        if (VERSIONED.test(tool.name)) {
          context.report({
            messageId: "versioned",
            data: { tool: tool.name },
            tool: index,
            path: "/name",
          });
        }
      },
    };
  },
});
