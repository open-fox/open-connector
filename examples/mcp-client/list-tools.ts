// MCP tools endpoint exposed by the local runtime.

import { localHeaders } from "../local-http/client.ts";

const response = await fetch("http://localhost:3000/mcp/tools", {
  headers: localHeaders(),
});
const payload = (await response.json()) as {
  tools?: Array<{ name: string; description: string; inputSchema: unknown }>;
};
const tools = payload.tools ?? [];

console.log(`Found ${tools.length} MCP-style tools.`);
for (const tool of tools.slice(0, 10)) {
  console.log(`- ${tool.name}: ${tool.description}`);
}
