import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType, IndexedProduct } from "../state.js";
import { callTool, parseToolResult, getMcpClient } from "../../mcp/client.js";
import type { Logger } from "../../logger.js";
import type { ProductSummary, ProductDetail } from "@shopping-agent/shared";

function toIndexedProduct(product: ProductSummary | ProductDetail): IndexedProduct {
  if ("shortDescription" in product) {
    return product as IndexedProduct;
  }
  const desc = (product as ProductDetail).description ?? "";
  const shortDescription = desc.length > 140 ? desc.slice(0, 139) + "…" : desc;
  return { ...(product as ProductDetail), shortDescription, detail: product as ProductDetail };
}

export class SearchExplorerNode extends BaseGraphNode {
  private tools: DynamicStructuredTool[] | null = null;

  constructor(config: NodeModelConfig) {
    super(config);
  }

  private async discoverTools(): Promise<DynamicStructuredTool[]> {
    if (this.tools !== null) {
      return this.tools;
    }

    const client = getMcpClient();
    const toolsResponse = await client.listTools();

    this.tools = (toolsResponse.tools || []).map(tool => {
      const schema = (tool.inputSchema as Record<string, unknown>) || {};
      return new DynamicStructuredTool({
        name: tool.name,
        description: tool.description || `MCP tool: ${tool.name}`,
        schema: schema as unknown as z.ZodType,
        func: async () => {
          throw new Error("Tool execution handled by SearchExplorerNode");
        },
      });
    });

    return this.tools;
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { currentIntent, messages } = state;

    if (!currentIntent) {
      log.warn({ event: "search.explorer.no_intent" }, "search explorer called without current intent");
      return {};
    }

    try {
      const tools = await this.discoverTools();

      let slotContext = "";
      if (currentIntent.slots) {
        const slots = currentIntent.slots;
        const slotParts: string[] = [];
        if (slots.query) slotParts.push(`search query: "${slots.query}"`);
        if (slots.category) slotParts.push(`category: "${slots.category}"`);
        if (slots.productId) slotParts.push(`product ID: ${slots.productId}`);
        if (slots.sortBy) slotParts.push(`sort by: ${slots.sortBy}`);
        if (slots.order) slotParts.push(`sort order: ${slots.order}`);
        slotContext = slotParts.length > 0 ? `\nAvailable slots: ${slotParts.join(", ")}` : "";
      }

      const systemPrompt = `You are a shopping assistant with access to product search and discovery tools.
Your job is to pick the right tool to help the user based on their intent and query.
The user's detected intent right now is: ${currentIntent.type} (confidence: ${currentIntent.confidence}) — use this as a hint, but feel free to use other tools if they better fit the request.${slotContext}

Use the conversation history below — including any earlier tool calls and results from this turn — to avoid redundant calls and inform your choice.`;

      const modelWithTools = this.llm.bindTools(tools, { parallel_tool_calls: false });
      const response = await modelWithTools.invoke([
        { type: "system" as const, content: systemPrompt },
        ...messages,
      ]);

      if (!response.tool_calls || response.tool_calls.length === 0) {
        log.warn({ event: "search.explorer.no_tool_call" }, "LLM did not select a tool");
        return { productResults: [] };
      }

      log.info({ tool_calls_length: response.tool_calls.length }, "LLM Tool calls length");

      const toolCall = response.tool_calls[0];
      const toolName = toolCall.name;
      const toolArgs = toolCall.args as Record<string, unknown>;

      log.info(
        { event: "search.explorer.tool_selected", tool: toolName, args: toolArgs },
        `search explorer selected tool: ${toolName}`,
      );

      const result = await callTool(log, toolName, toolArgs);
      const payload = parseToolResult(result);

      const toolResultMessage = new ToolMessage({
        content: JSON.stringify(payload),
        tool_call_id: toolCall.id ?? toolName,
      });
      const conversationUpdate = [response, toolResultMessage];

      if (toolName === "list_categories") {
        return { categories: payload.categories, messages: conversationUpdate };
      } else if (toolName === "get_product_by_id") {
        const product = payload;
        const indexedProduct = toIndexedProduct(product);
        return {
          productDetail: product,
          productResults: [product],
          productIndex: { [product.id]: indexedProduct },
          turnWidgets: state.turnId ? [{ turnId: state.turnId, products: [indexedProduct] }] : [],
          messages: conversationUpdate,
        };
      } else {
        const products = (payload.products as ProductSummary[]) || [];
        const indexedProducts = Object.fromEntries(products.map((p: ProductSummary) => [p.id, toIndexedProduct(p)]));
        return {
          productResults: products,
          productIndex: indexedProducts,
          turnWidgets: state.turnId && products.length > 0 ? [{ turnId: state.turnId, products }] : [],
          messages: conversationUpdate,
        };
      }
    } catch (error) {
      log.error({ err: error, intent: currentIntent.type, slots: currentIntent.slots }, "search explorer call failed");
      if (currentIntent.type === "product_detail") {
        return { productDetail: undefined };
      }
      return { productResults: [] };
    }
  }
}
