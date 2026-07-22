import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import { getMcpClient } from "../../mcp/client.js";

export class ProductDetailNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType): Promise<Partial<ShoppingStateType>> {
    const { slots } = state;
    const client = getMcpClient();

    try {
      let productId = slots?.productId;

      if (!productId && slots?.query) {
        const searchResult = await client.callTool({
          name: "search_products",
          arguments: {
            q: slots.query,
            limit: 1,
          },
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
        const toolResult = await client.callTool({
          name: "get_product_by_id",
          arguments: { id: productId },
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
      console.error("[ProductDetailNode] Error:", error);
      return { productDetail: undefined };
    }
  }
}
