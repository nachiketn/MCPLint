import { defineRule } from "../rule.js";
import type { RuleContext } from "../rule.js";
import { escapePointer, isObject } from "./util.js";

// Zero-width, bidi controls, word joiners, BOM, Unicode tag characters.
const INVISIBLE = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]|\uDB40[\uDC00-\uDC7F]/u;
const TAG = /<\s*\/?\s*(important|system|instructions?|secret|hidden)\b[^>]*>/i;
const OVERRIDE =
  /\b(ignore|disregard|forget)\b[^.]{0,40}\b(previous|prior|above|earlier|other)\b[^.]{0,20}\b(instructions?|rules|prompts?)\b/i;
const CONCEAL =
  /\b(do not|don't|never)\b[^.]{0,30}\b(tell|inform|mention|reveal|show|notify)\b[^.]{0,20}\b(the )?user\b/i;
const SENSITIVE =
  /(~\/\.ssh|id_rsa|id_ed25519|\.env\b|\.aws\/credentials|mcp\.json|\.npmrc|\.netrc|private key)/i;

export default defineRule({
  meta: {
    id: "hidden-instructions",
    code: "MCS501",
    type: "problem",
    category: "security",
    stability: "preview",
    recommended: false,
    defaultSeverity: "error",
    docs: {
      description:
        "Flag tool and parameter descriptions that carry instructions aimed at the model rather than documentation.",
      source:
        "Shaikh & Montaruli, arXiv 2611.03555 (tool poisoning); Invariant Labs mcp-scan tool-poisoning checks",
      rationale:
        "Descriptions are injected into the model's context verbatim. Poisoned descriptions hide instructions in invisible Unicode, pseudo tags like <IMPORTANT>, requests to ignore previous instructions, requests to keep something from the user, or references to credential files. These are regular-expression signals: they have false positives (a security tool may mention .env legitimately) and miss paraphrases, so this is a preview rule and findings need review.",
    },
    messages: {
      invisible: "{{where}} contains invisible Unicode characters.",
      tag: "{{where}} contains a pseudo-tag ({{match}}) addressed to the model.",
      override: "{{where}} asks the model to ignore other instructions.",
      conceal: "{{where}} asks the model to hide something from the user.",
      sensitive: "{{where}} references a credential or config file ({{match}}).",
    },
  },
  create(context) {
    function scan(text: string, where: string, tool: number, path: string, ctx: RuleContext) {
      const checks: [string, RegExp][] = [
        ["invisible", INVISIBLE],
        ["tag", TAG],
        ["override", OVERRIDE],
        ["conceal", CONCEAL],
        ["sensitive", SENSITIVE],
      ];
      for (const [messageId, pattern] of checks) {
        const match = pattern.exec(text);
        if (match) {
          ctx.report({ messageId, data: { where, match: match[0] }, tool, path });
        }
      }
    }
    return {
      tool(tool, index) {
        if (typeof tool.description === "string") {
          scan(tool.description, `Tool '${tool.name}' description`, index, "/description", context);
        }
        const props = isObject(tool.inputSchema) ? tool.inputSchema.properties : undefined;
        if (!isObject(props)) return;
        for (const [name, schema] of Object.entries(props)) {
          if (isObject(schema) && typeof schema.description === "string") {
            scan(
              schema.description,
              `Parameter '${name}' of tool '${tool.name}'`,
              index,
              `/inputSchema/properties/${escapePointer(name)}/description`,
              context,
            );
          }
        }
      },
    };
  },
});
