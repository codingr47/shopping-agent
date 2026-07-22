import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";

export class SupervisorNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType): Promise<Partial<ShoppingStateType>> {
    const { intent, slots } = state;

    let route: string = "summarize";

    if (intent === "search" && slots?.query) {
      route = "search";
    } else if (intent === "browse_category") {
      if (slots?.category) {
        route = "category";
      } else {
        route = "category";
      }
    } else if (intent === "product_detail" && slots?.productId) {
      route = "detail";
    }

    return { route: route as any };
  }
}
