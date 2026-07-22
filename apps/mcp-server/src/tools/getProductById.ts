import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProductByIdInput, type GetProductByIdInput } from "@shopping-agent/shared";
import * as dummyjson from "../dummyjsonClient.js";
import { toDetail } from "../trim.js";

export function registerGetProductById(server: McpServer) {
  server.registerTool(
    "get_product_by_id",
    {
      description: "Get detailed information about a single product by ID.",
      inputSchema: getProductByIdInput.shape,
    },
    async (input: GetProductByIdInput) => {
      try {
        const product = await dummyjson.get(`/products/${input.id}`);

        const detail = toDetail(product);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(detail),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching product details: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
