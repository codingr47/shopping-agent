import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listProductsInput, type ListProductsInput } from "@shopping-agent/shared";
import * as dummyjson from "../dummyjsonClient.js";
import { toSummary, type DummyJsonProduct } from "../trim.js";

export function registerListProducts(server: McpServer) {
  server.registerTool(
    "list_products",
    {
      description:
        "List products with optional pagination, sorting, and filtering.",
      inputSchema: listProductsInput.shape,
    },
    async (input: ListProductsInput) => {
      try {
        const params: Record<string, any> = {
          limit: Math.min(input.limit ?? 10, 20),
          skip: input.skip ?? 0,
        };

        if (input.sortBy) {
          params.sortBy = input.sortBy;
          if (input.order) {
            params.order = input.order;
          }
        }

        const data = await dummyjson.get<{
          products: DummyJsonProduct[];
          total: number;
        }>("/products", params);

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
              text: `Error listing products: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
