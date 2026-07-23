import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { env } from "../env.js";
import { logger, type Logger } from "../logger.js";

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

  logger.info("MCP client connected to DummyJSON Products MCP server");

  return _client;
}

export function getMcpClient(): Client {
  if (!_client) {
    throw new Error("MCP client not initialized. Call initializeMcpClient() first.");
  }
  return _client;
}

export async function callTool(log: Logger, name: string, args: Record<string, unknown>): Promise<any> {
  const start = performance.now();
  log.debug({ event: "mcp.call.start", tool: name, args }, `MCP call: ${name}`);

  try {
    const client = getMcpClient();
    const result = await client.callTool({ name, arguments: args });
    const duration = Math.round(performance.now() - start);
    log.info(
      { event: "mcp.call.end", tool: name, durationMs: duration },
      `MCP call ${name} completed`,
    );
    return result;
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    log.error(
      { event: "mcp.call.error", tool: name, durationMs: duration, err },
      `MCP call ${name} failed`,
    );
    throw err;
  }
}

export function parseToolResult<T = any>(result: any): T {
  const content = result?.content?.[0];
  if (result?.isError || !content || content.type !== "text") {
    throw new Error(typeof content?.text === "string" ? content.text : "MCP tool call returned no usable content");
  }
  return JSON.parse(content.text);
}
