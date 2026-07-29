import { HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType, IndexedProduct, Slots } from "../state.js";
import { callTool, parseToolResult, getMcpClient } from "../../mcp/client.js";
import type { Logger } from "../../logger.js";
import type { ProductSummary, ProductDetail } from "@shopping-agent/shared";

type CategoriesPayload = { categories: string[] };
type ProductsPayload = { products: ProductSummary[]; total: number };

function toIndexedProduct(product: ProductSummary | ProductDetail): IndexedProduct {
  if ("shortDescription" in product) {
    return product as IndexedProduct;
  }
  const desc = (product as ProductDetail).description ?? "";
  const shortDescription = desc.length > 140 ? desc.slice(0, 139) + "…" : desc;
  return { ...(product as ProductDetail), shortDescription, detail: product as ProductDetail };
}

function describeSlots(slots: Slots): string {
  const parts = Object.entries(slots)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([key, v]) => `${key}: ${Array.isArray(v) ? v.join(", ") : v}`);
  return parts.length > 0 ? `\nAvailable slots: ${parts.join(", ")}` : "";
}

function deriveStateFromPayload(
  payload: unknown,
  state: ShoppingStateType,
  log: Logger,
): Partial<ShoppingStateType> {
  const p = payload as Partial<CategoriesPayload & ProductsPayload & ProductDetail>;

  if (payload && typeof payload === "object" && Array.isArray(p.categories)) {
    return { categories: p.categories };
  }

  if (payload && typeof payload === "object" && Array.isArray(p.products)) {
    const products = p.products as ProductSummary[];
    const indexedProducts = Object.fromEntries(products.map(prod => [prod.id, toIndexedProduct(prod)]));
    return {
      productResults: products,
      productIndex: indexedProducts,
      turnWidgets: state.turnId && products.length > 0 ? [{ turnId: state.turnId, products }] : [],
    };
  }

  if (payload && typeof payload === "object" && typeof p.id === "number" && typeof p.title === "string") {
    const productDetail = payload as ProductDetail;
    const indexedProduct = toIndexedProduct(productDetail);
    return {
      productDetail,
      productResults: [indexedProduct],
      productIndex: { [productDetail.id]: indexedProduct },
      turnWidgets: state.turnId ? [{ turnId: state.turnId, products: [indexedProduct] }] : [],
    };
  }

  log.warn(
    { event: "search.explorer.unknown_payload_shape", payloadKeys: Object.keys(payload ?? {}) },
    "tool payload shape not recognized",
  );
  return { productResults: [] };
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

      const slotContext = currentIntent.slots ? describeSlots(currentIntent.slots) : "";

      const systemPrompt = `You are a shopping assistant with access to product search and discovery tools.
Your job is to pick the right tool to help the user based on their intent and query.
The user's detected intent right now is: ${currentIntent.type} (confidence: ${currentIntent.confidence}) — use this as a hint, but feel free to use other tools if they better fit the request.${slotContext}

Use the conversation history below — including any earlier tool calls and results from this turn — to avoid redundant calls and inform your choice.`;

      const windowedMessages = await this.selectContextWindow(messages);

      const modelWithTools = this.llm.bindTools(tools, { parallel_tool_calls: false });
      const response = await modelWithTools.invoke([
        { type: "system" as const, content: systemPrompt },
        ...windowedMessages,
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

      const payloadState = deriveStateFromPayload(payload, state, log);
      return { ...payloadState, messages: conversationUpdate };
    } catch (error) {
      log.error({ err: error, intent: currentIntent.type, slots: currentIntent.slots }, "search explorer call failed");
      if (currentIntent.type === "product_detail") {
        return { productDetail: undefined };
      }
      return { productResults: [] };
    }
  }
}
