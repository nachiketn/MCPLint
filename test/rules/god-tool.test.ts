import coarseAnnotations from "../../src/rules/coarse-annotations.js";
import godToolDispatch from "../../src/rules/god-tool-dispatch.js";
import godToolPassthrough from "../../src/rules/god-tool-passthrough.js";
import { RuleTester } from "../../src/testing/rule-tester.js";

const tester = new RuleTester();

const enumDispatch = (name: string, selector: string, values: string[], extra: object = {}) => ({
  name,
  description: `Run one of several ${name} operations.`,
  inputSchema: {
    type: "object",
    properties: { [selector]: { type: "string", enum: values, description: "Operation" } },
    required: [selector],
  },
  ...extra,
});

const unionDispatch = {
  name: "manage_credentials",
  description: "Manage credentials.",
  inputSchema: {
    oneOf: [
      { type: "object", properties: { action: { const: "list" } } },
      { type: "object", properties: { action: { const: "get" }, id: { type: "string" } } },
      { type: "object", properties: { action: { const: "create" }, data: { type: "object" } } },
      { type: "object", properties: { action: { const: "delete" }, id: { type: "string" } } },
    ],
  },
};

tester.run(godToolDispatch, {
  valid: [
    { server: { tools: [enumDispatch("set_order", "order", ["asc", "desc", "none", "random"])] } },
    {
      name: "below minOperations",
      server: { tools: [enumDispatch("diff", "mode", ["staged", "unstaged"])] },
    },
    {
      name: "minOperations option",
      options: { minOperations: 10 },
      server: {
        tools: [
          enumDispatch("issue_read", "method", [
            "get",
            "get_comments",
            "get_labels",
            "get_sub_issues",
          ]),
        ],
      },
    },
  ],
  invalid: [
    {
      server: {
        tools: [
          enumDispatch("issue_read", "method", [
            "get",
            "get_comments",
            "get_labels",
            "get_sub_issues",
          ]),
        ],
      },
      errors: [
        {
          messageId: "dispatch",
          message:
            "Tool 'issue_read' dispatches 4 operations through 'method' (get, get_comments, get_labels, get_sub_issues). Split it into one tool per operation, or at least per risk class.",
          pointer: "/tools/0/inputSchema/properties/method",
        },
      ],
    },
    {
      server: {
        tools: [enumDispatch("repo", "operationType", ["list", "create", "delete", "archive"])],
      },
      errors: [{ messageId: "dispatchMixed" }],
    },
    {
      name: "discriminated union",
      server: { tools: [unionDispatch] },
      errors: [{ messageId: "dispatchMixed", pointer: "/tools/0/inputSchema/oneOf" }],
    },
  ],
});

tester.run(coarseAnnotations, {
  valid: [
    {
      server: {
        tools: [enumDispatch("issue_read", "method", ["get", "get_comments", "list_labels"])],
      },
    },
    {
      name: "not a dispatch tool",
      server: { tools: [{ name: "delete_issue", description: "Delete." }] },
    },
  ],
  invalid: [
    {
      server: {
        tools: [
          enumDispatch("cluster", "action", ["list", "describe", "delete", "scale"], {
            annotations: { readOnlyHint: true },
          }),
        ],
      },
      errors: [{ messageId: "readOnlyOnWrites", pointer: "/tools/0/annotations/readOnlyHint" }],
    },
    {
      server: {
        tools: [
          enumDispatch("cluster", "action", ["list", "delete"], {
            annotations: { destructiveHint: true },
          }),
        ],
      },
      errors: [{ messageId: "coarse" }],
    },
  ],
});

tester.run(godToolPassthrough, {
  valid: [
    {
      name: "a search query is not code",
      server: {
        tools: [
          {
            name: "search_docs",
            description: "Search the docs.",
            inputSchema: { type: "object", properties: { query: { type: "string" } } },
          },
        ],
      },
    },
    {
      name: "command with a closed set",
      server: {
        tools: [
          {
            name: "run_task",
            description: "Run a predefined task.",
            inputSchema: { type: "object", properties: { command: { enum: ["build", "test"] } } },
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
            name: "call_aws",
            description: "Execute AWS CLI commands.",
            inputSchema: { type: "object", properties: { cli_command: { type: "string" } } },
          },
        ],
      },
      errors: [
        { messageId: "codePassthrough", pointer: "/tools/0/inputSchema/properties/cli_command" },
      ],
    },
    {
      server: {
        tools: [
          {
            name: "api_request",
            description: "Send a request to the REST API.",
            inputSchema: {
              type: "object",
              properties: {
                method: { enum: ["GET", "POST", "PATCH", "DELETE"] },
                path: { type: "string" },
                body: { type: "object" },
              },
            },
          },
        ],
      },
      errors: [{ messageId: "httpPassthrough" }],
    },
  ],
});
