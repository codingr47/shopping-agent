import { AIMessage } from "@langchain/core/messages";
import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import type { Logger } from "../../logger.js";

export class OffTopicResponderNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const finalMessage =
      "I'm here to help you discover products! Try asking me about specific items, browse categories, or search by keywords. I can answer questions about product details, prices, and availability.";

    return {
      finalMessage,
      messages: [new AIMessage(finalMessage)],
    };
  }
}
