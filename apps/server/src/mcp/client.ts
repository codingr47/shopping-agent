import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { env } from "../env.js";

let _client: Client | null = null;

export async function initializeMcpClient(): Promise<Client> {
  if (_client) {
    return _client;
  }

  const args = env.MCP_SERVER_ARGS.split(",").map(a => a.trim());

  const transport = new StdioClientTransport({
    command: env.MCP_SERVER_CMD,
    args,
  });

  _client = new Client({
    name: "shopping-agent-server",
    version: "1.0.0",
  });

  await _client.connect(transport);

  console.log("[MCP] Client connected to DummyJSON Products MCP server");

  return _client;
}

export function getMcpClient(): Client {
  if (!_client) {
    throw new Error("MCP client not initialized. Call initializeMcpClient() first.");
  }
  return _client;
}
