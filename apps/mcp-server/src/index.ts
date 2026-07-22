import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchProducts } from "./tools/searchProducts.js";
import { registerListProducts } from "./tools/listProducts.js";
import { registerGetProductById } from "./tools/getProductById.js";
import { registerListCategories } from "./tools/listCategories.js";
import { registerGetProductsByCategory } from "./tools/getProductsByCategory.js";

const server = new McpServer({
  name: "dummyjson-products",
  version: "1.0.0",
});

registerSearchProducts(server);
registerListProducts(server);
registerGetProductById(server);
registerListCategories(server);
registerGetProductsByCategory(server);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("[MCP] DummyJSON Products server started");
