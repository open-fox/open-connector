import type { ActionDefinition, JsonSchema } from "../core/types.ts";

/**
 * Render a compact action guide for coding agents and humans who want the raw
 * local HTTP contract without browsing the full catalog JSON.
 */
export function renderActionMarkdown(action: ActionDefinition): string {
  const exampleInput = buildExampleInput(action.inputSchema);
  const parameterRows = describeParameters(action.inputSchema);

  return [
    `# ${action.id}`,
    "",
    action.description,
    "",
    "## Execute",
    "",
    "```bash",
    `curl -s http://localhost:3000/api/actions/${action.id}/execute \\`,
    "  -H 'content-type: application/json' \\",
    `  -d '${JSON.stringify({ input: exampleInput })}'`,
    "```",
    "",
    "```ts",
    `const response = await fetch("http://localhost:3000/api/actions/${action.id}/execute", {`,
    `  method: "POST",`,
    `  headers: { "content-type": "application/json" },`,
    `  body: JSON.stringify(${JSON.stringify({ input: exampleInput }, null, 2)}),`,
    `});`,
    `const result = await response.json();`,
    "```",
    "",
    "## Input Parameters",
    "",
    parameterRows.length > 0
      ? ["| Name | Required | Type | Description |", "| --- | --- | --- | --- |", ...parameterRows].join("\n")
      : "This action does not require input parameters.",
    "",
    "## Required Scopes",
    "",
    action.requiredScopes.length > 0
      ? action.requiredScopes.map((scope) => `- \`${scope}\``).join("\n")
      : "No provider scopes are required.",
    "",
    "## Notes For Agents",
    "",
    "- Use the local runtime endpoint above; do not call provider APIs directly unless the user asks.",
    "- Send JSON with a top-level `input` object.",
    "- If execution fails with a credential error, ask the user to connect the app in the local console.",
  ].join("\n");
}

function describeParameters(schema: JsonSchema): string[] {
  const properties = readProperties(schema);
  const required = new Set(readRequired(schema));
  return Object.entries(properties).map(([name, property]) =>
    [
      `\`${name}\``,
      required.has(name) ? "Yes" : "No",
      `\`${describeType(property)}\``,
      escapeTableText(readDescription(property)),
    ].join(" | "),
  );
}

function buildExampleInput(schema: JsonSchema): Record<string, unknown> {
  const properties = readProperties(schema);
  const input: Record<string, unknown> = {};
  for (const name of readRequired(schema)) {
    input[name] = exampleValue(properties[name]);
  }
  return input;
}

function readProperties(schema: JsonSchema): Record<string, JsonSchema> {
  return schema.properties && typeof schema.properties === "object"
    ? (schema.properties as Record<string, JsonSchema>)
    : {};
}

function readRequired(schema: JsonSchema): string[] {
  return Array.isArray(schema.required)
    ? schema.required.filter((value): value is string => typeof value === "string")
    : [];
}

function describeType(schema: JsonSchema | undefined): string {
  if (!schema) {
    return "unknown";
  }
  if (typeof schema.const === "string" || typeof schema.const === "number" || typeof schema.const === "boolean") {
    return JSON.stringify(schema.const);
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }
  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.map((item) => describeType(item as JsonSchema)).join(" | ");
  }
  return typeof schema.type === "string" ? schema.type : "unknown";
}

function readDescription(schema: JsonSchema | undefined): string {
  return schema && typeof schema.description === "string" ? schema.description : "";
}

function escapeTableText(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function exampleValue(schema: JsonSchema | undefined): unknown {
  if (!schema) {
    return "";
  }
  if (schema.default !== undefined) {
    return schema.default;
  }
  if (schema.const !== undefined) {
    return schema.const;
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum[0];
  }
  if (schema.type === "integer" || schema.type === "number") {
    return 1;
  }
  if (schema.type === "boolean") {
    return false;
  }
  if (schema.type === "array") {
    return [];
  }
  if (schema.type === "object") {
    return {};
  }
  return "";
}
