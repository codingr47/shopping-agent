import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import { callTool, parseToolResult } from "../../mcp/client.js";
import type { Logger } from "../../logger.js";

export class SearchExplorerNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { currentIntent, slots, messages } = state;

    if (!currentIntent) {
      log.warn({ event: "search.explorer.no_intent" }, "search explorer called without current intent");
      return {};
    }

    try {
      const intentType = currentIntent.type;
      const turnIndex = messages.length;

      if (intentType === "search") {
        if (slots?.query) {
          const result = await callTool(log, "search_products", {
            q: slots.query,
            limit: 5,
          });
          const payload = parseToolResult(result);
          return {
            productResults: payload.products,
            turnWidgets: [{ turnIndex, products: payload.products }],
          };
        } else {
          const result = await callTool(log, "list_products", {
            limit: 10,
            sortBy: slots?.sortBy || "title",
            order: slots?.order || "asc",
          });
          const payload = parseToolResult(result);
          return {
            productResults: payload.products,
            turnWidgets: [{ turnIndex, products: payload.products }],
          };
        }
      } else if (intentType === "browse_category") {
        if (slots?.category) {
          const result = await callTool(log, "get_products_by_category", {
            slug: slots.category,
            limit: 10,
          });
          const payload = parseToolResult(result);
          return {
            productResults: payload.products,
            turnWidgets: [{ turnIndex, products: payload.products }],
          };
        } else {
          const result = await callTool(log, "list_categories", {});
          const payload = parseToolResult(result);
          return {
            categories: payload.categories,
          };
        }
      } else if (intentType === "product_detail") {
        let productId = slots?.productId;

        if (!productId && slots?.query) {
          const searchResult = await callTool(log, "search_products", {
            q: slots.query,
            limit: 1,
          });
          const payload = parseToolResult(searchResult);
          if (payload.products && payload.products.length > 0) {
            productId = payload.products[0].id;
          }
        }

        if (productId) {
          const result = await callTool(log, "get_product_by_id", {
            id: productId,
          });
          const product = parseToolResult(result);
          return {
            productDetail: product,
            productResults: [product],
            turnWidgets: [{ turnIndex, products: [product] }],
          };
        }

        return { productDetail: undefined };
      }

      return { productResults: [] };
    } catch (error) {
      log.error({ err: error, intent: currentIntent.type, slots }, "search explorer call failed");
      if (currentIntent.type === "product_detail") {
        return { productDetail: undefined };
      }
      return { productResults: [] };
    }
  }
}
