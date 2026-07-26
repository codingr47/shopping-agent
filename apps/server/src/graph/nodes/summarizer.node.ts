import { AIMessage, RemoveMessage } from "@langchain/core/messages";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import type { Logger } from "../../logger.js";

export class SummarizerNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { productResults, productDetail, categories, messages } = state;

    const contextParts: string[] = [];

    if (productResults && productResults.length > 0) {
      contextParts.push(`Found ${productResults.length} product(s). Here are the top matches:`);
    }
    if (productDetail) {
      contextParts.push(`Here are the details for the product:`);
    }
    if (categories && categories.length > 0) {
      contextParts.push(`Available categories: ${categories.join(", ")}`);
    }

    const contextText = contextParts.length > 0 ? contextParts.join(" ") : "No results found.";

    const systemPrompt = `You are a helpful shopping assistant. The user has just made a request.
Based on the context provided, generate a brief, friendly response (2-3 sentences max).
Suggest one natural next step they could take (e.g., "Would you like to see more options?" or "I can show you other items in this category").
Do NOT describe the products in detail — that's what the product cards are for. Just acknowledge the results and suggest a next action.

Context: ${contextText}`;

    const response = await this.llm.invoke([
      { type: "system" as const, content: systemPrompt },
      ...messages,
    ]);

    const finalMessage =
      typeof response.content === "string"
        ? response.content
        : "I found some results for you!";

    const toolArtifacts = messages.filter(
      m => m.getType() === "tool" || (m instanceof AIMessage && (m.tool_calls?.length ?? 0) > 0)
    );
    const removals = toolArtifacts.map(m => new RemoveMessage({ id: m.id! }));

    return {
      finalMessage,
      messages: [...removals, new AIMessage(finalMessage)],
    };
  }
}
