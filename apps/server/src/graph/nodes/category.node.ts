import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import { callTool } from "../../mcp/client.js";
import type { Logger } from "../../logger.js";

export class CategoryNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { slots } = state;

    try {
      if (slots?.category) {
        const toolResult = await callTool(log, "get_products_by_category", {
          slug: slots.category,
          limit: 10,
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
        const toolResult = await callTool(log, "list_categories", {});

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
      log.error({ err: error, slots }, "category lookup failed");
      return { productResults: [] };
    }
  }
}
