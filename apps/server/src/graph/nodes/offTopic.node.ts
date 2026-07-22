import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";

export class OffTopicResponderNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType): Promise<Partial<ShoppingStateType>> {
    return {
      finalMessage:
        "I'm here to help you discover products! Try asking me about specific items, browse categories, or search by keywords. I can answer questions about product details, prices, and availability.",
    };
  }
}
