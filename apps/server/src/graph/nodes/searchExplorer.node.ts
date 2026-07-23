import { HumanMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import { callTool, parseToolResult } from "../../mcp/client.js";
import type { Logger } from "../../logger.js";
import {
  searchProductsInput,
  listProductsInput,
  getProductByIdInput,
  listCategoriesInput,
  getProductsByCategoryInput,
} from "@shopping-agent/shared";

export class SearchExplorerNode extends BaseGraphNode {
  private tools: DynamicStructuredTool[];

  constructor(config: NodeModelConfig) {
    super(config);

    this.tools = [
      new DynamicStructuredTool({
        name: "search_products",
        description: "Search the product catalog by free-text query. Returns a trimmed list of matching products.",
        schema: searchProductsInput,
        func: async () => {
          throw new Error("Tool execution handled by SearchExplorerNode");
        },
      }),
      new DynamicStructuredTool({
        name: "list_products",
        description: "List products with optional pagination, sorting, and filtering.",
        schema: listProductsInput,
        func: async () => {
          throw new Error("Tool execution handled by SearchExplorerNode");
        },
      }),
      new DynamicStructuredTool({
        name: "get_products_by_category",
        description: "Get products within a specific category by slug.",
        schema: getProductsByCategoryInput,
        func: async () => {
          throw new Error("Tool execution handled by SearchExplorerNode");
        },
      }),
      new DynamicStructuredTool({
        name: "list_categories",
        description: "Get a list of available product categories.",
        schema: listCategoriesInput,
        func: async () => {
          throw new Error("Tool execution handled by SearchExplorerNode");
        },
      }),
      new DynamicStructuredTool({
        name: "get_product_by_id",
        description: "Get detailed information about a single product by its ID.",
        schema: getProductByIdInput,
        func: async () => {
          throw new Error("Tool execution handled by SearchExplorerNode");
        },
      }),
    ];
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { currentIntent, slots, messages } = state;

    if (!currentIntent) {
      log.warn({ event: "search.explorer.no_intent" }, "search explorer called without current intent");
      return {};
    }

    try {
      const lastUserMessage = messages
        .slice()
        .reverse()
        .find(msg => msg.getType() === "human");

      const userQuery = lastUserMessage ? lastUserMessage.content : "";
      const turnIndex = messages.length;
      const intentType = currentIntent.type;

      let slotContext = "";
      if (slots) {
        const slotParts: string[] = [];
        if (slots.query) slotParts.push(`search query: "${slots.query}"`);
        if (slots.category) slotParts.push(`category: "${slots.category}"`);
        if (slots.productId) slotParts.push(`product ID: ${slots.productId}`);
        if (slots.sortBy) slotParts.push(`sort by: ${slots.sortBy}`);
        if (slots.order) slotParts.push(`sort order: ${slots.order}`);
        slotContext = slotParts.length > 0 ? `Available slots: ${slotParts.join(", ")}` : "";
      }

      const systemPrompt = `You are a shopping assistant with access to product search and discovery tools.
Your job is to pick the right tool to help the user based on their intent and query.
The user's detected intent is: ${intentType} (as a hint, but feel free to use other tools if they better fit the user's request).
${slotContext}

Use your judgment and the available tools to provide the best shopping assistance.`;

      const userPrompt = `User asked: "${userQuery}"

Choose the best tool to help them with their request.`;

      const modelWithTools = this.llm.bindTools(this.tools);
      const response = await modelWithTools.invoke([
        { type: "system" as const, content: systemPrompt },
        new HumanMessage(userPrompt),
      ]);

      if (!response.tool_calls || response.tool_calls.length === 0) {
        log.warn({ event: "search.explorer.no_tool_call" }, "LLM did not select a tool");
        return { productResults: [] };
      }

      const toolCall = response.tool_calls[0];
      const toolName = toolCall.name;
      const toolArgs = toolCall.args as Record<string, unknown>;

      log.info(
        { event: "search.explorer.tool_selected", tool: toolName, args: toolArgs },
        `search explorer selected tool: ${toolName}`,
      );

      const result = await callTool(log, toolName, toolArgs);
      const payload = parseToolResult(result);

      if (toolName === "list_categories") {
        return { categories: payload.categories };
      } else if (toolName === "get_product_by_id") {
        const product = payload;
        return {
          productDetail: product,
          productResults: [product],
          turnWidgets: [{ turnIndex, products: [product] }],
        };
      } else {
        const products = payload.products || [];
        return {
          productResults: products,
          turnWidgets: products.length > 0 ? [{ turnIndex, products }] : [],
        };
      }
    } catch (error) {
      log.error({ err: error, intent: currentIntent.type, slots }, "search explorer call failed");
      if (currentIntent.type === "product_detail") {
        return { productDetail: undefined };
      }
      return { productResults: [] };
    }
  }
}
