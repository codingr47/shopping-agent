import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchProductsInput, type SearchProductsInput } from "@shopping-agent/shared";
import * as dummyjson from "../dummyjsonClient.js";
import { toSummary, type DummyJsonProduct } from "../trim.js";

export function registerSearchProducts(server: McpServer) {
  server.registerTool(
    "search_products",
    {
      description:
        "Search the product catalog by free-text query. Returns a small trimmed list.",
      inputSchema: searchProductsInput.shape,
    },
    async (input: SearchProductsInput) => {
      try {
        const params = {
          q: input.q,
          limit: Math.min(input.limit ?? 5, 10),
          skip: input.skip ?? 0,
        };

        const data = await dummyjson.get<{
          products: DummyJsonProduct[];
          total: number;
        }>("/products/search", params);

        const payload = {
          products: data.products.map(toSummary),
          total: data.total,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(payload),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error searching products: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
