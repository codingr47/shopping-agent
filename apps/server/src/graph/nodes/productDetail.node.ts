import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import { callTool } from "../../mcp/client.js";
import type { Logger } from "../../logger.js";

export class ProductDetailNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { slots } = state;

    try {
      let productId = slots?.productId;

      if (!productId && slots?.query) {
        const searchResult = await callTool(log, "search_products", {
          q: slots.query,
          limit: 1,
        });

        const content = (searchResult.content as any[])?.[0];
        if (content && content.type === "text") {
          const payload = JSON.parse(content.text);
          if (payload.products && payload.products.length > 0) {
            productId = payload.products[0].id;
          }
        }
      }

      if (productId) {
        const toolResult = await callTool(log, "get_product_by_id", {
          id: productId,
        });

        const content = (toolResult.content as any[])?.[0];
        if (content && content.type === "text") {
          const product = JSON.parse(content.text);
          return {
            productDetail: product,
            productResults: [product],
            turnWidgets: [
              {
                turnIndex: state.messages.length,
                products: [product],
              },
            ],
          };
        }
      }

      return { productDetail: undefined };
    } catch (error) {
      log.error({ err: error, slots }, "product detail lookup failed");
      return { productDetail: undefined };
    }
  }
}
