import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import type { Logger } from "../../logger.js";

export class SupervisorNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
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

    log.info({ event: "route.decision", intent, route }, "supervisor routed");

    return { route: route as any };
  }
}
