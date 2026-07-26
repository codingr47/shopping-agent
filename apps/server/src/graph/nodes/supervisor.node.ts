import { BaseGraphNode, NodeModelConfig } from "../baseNode.js";
import { ShoppingStateType } from "../state.js";
import type { Logger } from "../../logger.js";

const MIN_INTENT_CONFIDENCE = 0.4;

export class SupervisorNode extends BaseGraphNode {
  constructor(config: NodeModelConfig) {
    super(config);
  }

  async run(state: ShoppingStateType, log: Logger): Promise<Partial<ShoppingStateType>> {
    const { intents, intentCursor } = state;

    let cursor = intentCursor;
    while (
      cursor < intents.length &&
      (intents[cursor].node !== "searchExplorer" || intents[cursor].confidence < MIN_INTENT_CONFIDENCE)
    ) {
      cursor++;
    }

    if (cursor >= intents.length) {
      log.debug({ event: "route.decision", cursor, total: intents.length, route: "summarize" }, "supervisor exhausted intents, routing to summarize");
      return { route: "summarize", currentIntent: undefined };
    }

    const currentIntent = intents[cursor];
    log.debug(
      { event: "route.decision", intent: currentIntent.type, confidence: currentIntent.confidence, cursor, total: intents.length, route: "searchExplorer" },
      "supervisor routed to search explorer",
    );

    return { route: "searchExplorer", currentIntent, intentCursor: cursor + 1 };
  }
}
