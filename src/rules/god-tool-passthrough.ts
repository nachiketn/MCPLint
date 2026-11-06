import { defineRule } from "../rule.js";
import { literalValues, toolProperties, words } from "./util.js";

const CODE_PARAMS = new Set([
  "command",
  "cmd",
  "code",
  "script",
  "sql",
  "statement",
  "expression",
  "cli_command",
  "shell_command",
  "python_code",
]);
const EXEC_WORDS = new Set([
  "exec",
  "execute",
  "executes",
  "run",
  "runs",
  "eval",
  "evaluate",
  "call",
  "calls",
  "invoke",
  "raw",
  "arbitrary",
  "any",
  "generic",
]);
const HTTP_VERBS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
const URL_PARAMS = new Set(["path", "url", "endpoint", "uri", "route"]);

export default defineRule({
  meta: {
    id: "god-tool-passthrough",
    code: "MCS202",
    type: "suggestion",
    category: "god-tool",
    stability: "preview",
    recommended: false,
    defaultSeverity: "warn",
    docs: {
      description:
        "Flag tools that pass free-form commands, code, or HTTP requests through to an underlying system.",
      source:
        "mcpsmell pilot (Nov 2026): passthrough variant of the God Tool, seen in AWS call_aws, kubectl_generic, Supabase postgrestRequest",
      rationale:
        "A passthrough tool (run any CLI command, execute any code, send any HTTP request) is the limit case of a God Tool: its operation set is unbounded, so neither its description nor its annotations can describe what a call does, and approval prompts show an opaque string. The rule flags a free-form string parameter named like code or a command (command, code, script, sql, ...) on a tool whose name or description talks about executing, and generic HTTP tools that take a method and a path. This is a preview rule: passthrough tools are sometimes the product, so treat findings as design review items.",
    },
    messages: {
      codePassthrough:
        "Tool '{{tool}}' passes free-form '{{param}}' through for execution. Prefer typed operations, or scope and document what it may run.",
      httpPassthrough:
        "Tool '{{tool}}' is a generic HTTP passthrough ('{{method}}' + '{{url}}'). Prefer typed operations per endpoint.",
    },
  },
  create(context) {
    return {
      tool(tool, index) {
        const props = toolProperties(tool);
        const toolWords = new Set([...words(tool.name), ...words(tool.description ?? "")]);
        const execLike = [...toolWords].some((w) => EXEC_WORDS.has(w));

        for (const prop of props) {
          const name = prop.name.toLowerCase();
          if (!CODE_PARAMS.has(name) || !execLike) continue;
          const type = prop.schema.type;
          const stringish = type === "string" || type === "array" || type === undefined;
          const constrained =
            literalValues(prop.schema) !== undefined || typeof prop.schema.pattern === "string";
          if (stringish && !constrained) {
            context.report({
              messageId: "codePassthrough",
              data: { tool: tool.name, param: prop.name },
              tool: index,
              path: prop.path,
            });
            return;
          }
        }

        const method = props.find((p) => {
          const values = literalValues(p.schema)?.map((v) => v.toLowerCase());
          return values !== undefined && values.filter((v) => HTTP_VERBS.has(v)).length >= 3;
        });
        const url = props.find(
          (p) => URL_PARAMS.has(p.name.toLowerCase()) && literalValues(p.schema) === undefined,
        );
        if (method !== undefined && url !== undefined) {
          context.report({
            messageId: "httpPassthrough",
            data: { tool: tool.name, method: method.name, url: url.name },
            tool: index,
            path: method.path,
          });
        }
      },
    };
  },
});
