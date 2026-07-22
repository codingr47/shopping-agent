import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listCategoriesInput, type ListCategoriesInput } from "@shopping-agent/shared";
import * as dummyjson from "../dummyjsonClient.js";

export function registerListCategories(server: McpServer) {
  server.registerTool(
    "list_categories",
    {
      description:
        "Get a list of available product categories (slugs only for efficiency).",
      inputSchema: listCategoriesInput.shape,
    },
    async (_input: ListCategoriesInput) => {
      try {
        const categories = await dummyjson.get<string[]>(
          "/products/category-list",
        );

        const payload = {
          categories,
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
              text: `Error fetching categories: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
