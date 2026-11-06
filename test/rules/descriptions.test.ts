import missingDescription from "../../src/rules/missing-description.js";
import missingParameterDescription from "../../src/rules/missing-parameter-description.js";
import vagueDescription from "../../src/rules/vague-description.js";
import { RuleTester } from "../../src/testing/rule-tester.js";

const tester = new RuleTester();

tester.run(missingDescription, {
  valid: [
    { server: { tools: [{ name: "get_weather", description: "Current weather for a city." }] } },
  ],
  invalid: [
    {
      server: { tools: [{ name: "get_weather" }, { name: "get_forecast", description: "  " }] },
      errors: [
        {
          messageId: "missing",
          message: "Tool 'get_weather' has no description.",
          pointer: "/tools/0",
        },
        { messageId: "missing", pointer: "/tools/1" },
      ],
    },
  ],
});

tester.run(vagueDescription, {
  valid: [
    {
      server: {
        tools: [
          {
            name: "list_gateways",
            description: "List AI Gateways in the account, with their ids and log settings.",
          },
        ],
      },
    },
    { name: "missing descriptions are left to MCS101", server: { tools: [{ name: "x" }] } },
    {
      name: "minWords option",
      options: { minWords: 2 },
      server: { tools: [{ name: "now", description: "Current UTC time" }] },
    },
  ],
  invalid: [
    {
      server: { tools: [{ name: "list_gateways", description: "List Gateways" }] },
      errors: [{ messageId: "restatesName", pointer: "/tools/0/description" }],
    },
    {
      server: { tools: [{ name: "gitStatus", description: "Git status." }] },
      errors: [{ messageId: "restatesName" }],
    },
    {
      server: { tools: [{ name: "search", description: "Search Jira issues" }] },
      errors: [
        {
          messageId: "tooShort",
          message:
            "Tool 'search' has a 3-word description. Say what it returns and when to use it.",
        },
      ],
    },
  ],
});

tester.run(missingParameterDescription, {
  valid: [
    {
      server: {
        tools: [
          {
            name: "read_file",
            description: "Read a file.",
            inputSchema: {
              type: "object",
              properties: { path: { type: "string", description: "Absolute path" } },
            },
          },
        ],
      },
    },
    {
      name: "ignore and ignoreEnums options",
      options: { ignore: ["page"], ignoreEnums: true },
      server: {
        tools: [
          {
            name: "list",
            description: "List items.",
            inputSchema: {
              type: "object",
              properties: { page: { type: "number" }, order: { enum: ["asc", "desc"] } },
            },
          },
        ],
      },
    },
  ],
  invalid: [
    {
      server: {
        tools: [
          {
            name: "read_file",
            description: "Read a file.",
            inputSchema: {
              type: "object",
              properties: { path: { type: "string" }, "a/b": { type: "string", description: "" } },
            },
          },
        ],
      },
      errors: [
        { messageId: "missing", pointer: "/tools/0/inputSchema/properties/path" },
        { messageId: "missing", pointer: "/tools/0/inputSchema/properties/a~1b" },
      ],
    },
  ],
});
