import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import { getMcpClient } from "../../mcp/client.js";

export class CategoryNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType): Promise<Partial<ShoppingStateType>> {
    const { slots } = state;
    const client = getMcpClient();

    try {
      if (slots?.category) {
        const toolResult = await client.callTool({
          name: "get_products_by_category",
          arguments: {
            slug: slots.category,
            limit: 10,
          },
        });

        const content = (toolResult.content as any[])?.[0];
        if (content && content.type === "text") {
          const payload = JSON.parse(content.text);
          return {
            productResults: payload.products,
            turnWidgets: [
              {
                turnIndex: state.messages.length,
                products: payload.products,
              },
            ],
          };
        }
      } else {
        const toolResult = await client.callTool({
          name: "list_categories",
          arguments: {},
        });

        const content = (toolResult.content as any[])?.[0];
        if (content && content.type === "text") {
          const payload = JSON.parse(content.text);
          return {
            categories: payload.categories,
          };
        }
      }

      return { productResults: [] };
    } catch (error) {
      console.error("[CategoryNode] Error:", error);
      return { productResults: [] };
    }
  }
}
