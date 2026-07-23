import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import { callTool } from "../../mcp/client.js";
import type { Logger } from "../../logger.js";

export class ProductSearchNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { slots } = state;

    try {
      if (slots?.query) {
        const toolResult = await callTool(log, "search_products", {
          q: slots.query,
          limit: 5,
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
        const toolResult = await callTool(log, "list_products", {
          limit: 10,
          sortBy: slots?.sortBy || "title",
          order: slots?.order || "asc",
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
      log.error({ err: error, slots }, "product search failed");
      return {
        productResults: [],
      };
    }
  }
}
