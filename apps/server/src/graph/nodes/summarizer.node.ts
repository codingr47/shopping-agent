import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import type { Logger } from "../../logger.js";

export class SummarizerNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { productResults, productDetail, categories, messages } = state;

    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.getType() === "human");

    const userQuery = lastUserMessage ? lastUserMessage.content : "";

    let contextText = "";

    if (productResults && productResults.length > 0) {
      contextText = `Found ${productResults.length} product(s). Here are the top matches:`;
    } else if (productDetail) {
      contextText = `Here are the details for the product:`;
    } else if (categories && categories.length > 0) {
      contextText = `Available categories: ${categories.join(", ")}`;
    } else {
      contextText = "No results found.";
    }

    const systemPrompt = `You are a helpful shopping assistant. The user has just made a request.
Based on the context provided, generate a brief, friendly response (2-3 sentences max).
Suggest one natural next step they could take (e.g., "Would you like to see more options?" or "I can show you other items in this category").
Do NOT describe the products in detail — that's what the product cards are for. Just acknowledge the results and suggest a next action.`;

    const userPrompt = `User asked: "${userQuery}"

Context: ${contextText}

Generate a brief response and suggest a next step.`;

    const response = await this.llm.invoke([
      { type: "system" as const, content: systemPrompt },
      new HumanMessage(userPrompt),
    ]);

    const finalMessage =
      typeof response.content === "string"
        ? response.content
        : "I found some results for you!";

    return {
      finalMessage,
      messages: [new AIMessage(finalMessage)],
    };
  }
}
