import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProductsByCategoryInput, type GetProductsByCategoryInput } from "@shopping-agent/shared";
import * as dummyjson from "../dummyjsonClient.js";
import { toSummary, type DummyJsonProduct } from "../trim.js";

export function registerGetProductsByCategory(server: McpServer) {
  server.registerTool(
    "get_products_by_category",
    {
      description: "Get products within a specific category.",
      inputSchema: getProductsByCategoryInput.shape,
    },
    async (input: GetProductsByCategoryInput) => {
      try {
        const params = {
          limit: Math.min(input.limit ?? 10, 20),
          skip: input.skip ?? 0,
        };

        const data = await dummyjson.get<{
          products: DummyJsonProduct[];
          total: number;
        }>(`/products/category/${input.slug}`, params);

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
              text: `Error fetching products by category: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
