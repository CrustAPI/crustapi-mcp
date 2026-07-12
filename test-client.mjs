import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const serverPath = fileURLToPath(new URL("./server.mjs", import.meta.url));

const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
  cwd: dirname(serverPath),
  env: {
    ...process.env,
    CRUSTAPI_BASE_URL: process.env.CRUSTAPI_BASE_URL || "https://crustapi.com",
    CRUSTAPI_API_KEY: process.env.CRUSTAPI_API_KEY || "",
  },
});

const client = new Client({ name: "crustapi-test-client", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
console.log("tools/list ->", tools.tools.map((t) => t.name).join(", "));
console.log("tool schema keys ->", Object.keys(tools.tools[0].inputSchema.properties || {}).join(", "));

const result = await client.callTool({
  name: "search_local_businesses",
  arguments: { q: "coffee", location: "Austin, TX", limit: 2 },
});
const txt = result.content[0].text;
console.log("tools/call -> first 320 chars:\n" + txt.slice(0, 320));

await client.close();
