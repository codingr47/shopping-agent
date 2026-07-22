import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import { getMcpClient } from "../../mcp/client.js";

export class ProductSearchNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType): Promise<Partial<ShoppingStateType>> {
    const { slots } = state;
    const client = getMcpClient();

    try {
      if (slots?.query) {
        const toolResult = await client.callTool({
          name: "search_products",
          arguments: {
            q: slots.query,
            limit: 5,
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
          name: "list_products",
          arguments: {
            limit: 10,
            sortBy: slots?.sortBy || "title",
            order: slots?.order || "asc",
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
      }

      return {
        productResults: [],
      };
    } catch (error) {
      console.error("[ProductSearchNode] Error:", error);
      return {
        productResults: [],
      };
    }
  }
}
