import { StateGraph, START, END } from "@langchain/langgraph";
import { type BaseCheckpointSaver } from "@langchain/langgraph";
import { ShoppingState, type ShoppingStateType } from "./state.js";
import { GuardrailIntentClassifierNode } from "./nodes/guardrailIntentClassifier.node.js";
import { SupervisorNode } from "./nodes/supervisor.node.js";
import { SearchExplorerNode } from "./nodes/searchExplorer.node.js";
import { ComparisonNode } from "./nodes/comparison.node.js";
import { OffTopicResponderNode } from "./nodes/offTopic.node.js";
import { SummarizerNode } from "./nodes/summarizer.node.js";
import { getCheckpointer } from "../db/sqlite.js";
import { env } from "../env.js";

const GUARDRAIL_SEED = 7;

export function createGraph(checkpointer: BaseCheckpointSaver = getCheckpointer()) {
  const guardrailNode = new GuardrailIntentClassifierNode({
    model: env.NANO_MODEL,
    temperature: 0,
    seed: GUARDRAIL_SEED,
  });

  const supervisorNode = new SupervisorNode({
    model: env.MINI_MODEL,
  });

  const searchExplorerNode = new SearchExplorerNode({
    model: env.NANO_MODEL,
  });

  const comparisonNode = new ComparisonNode({
    model: env.MINI_MODEL,
  });

  const offTopicNode = new OffTopicResponderNode({
    model: env.NANO_MODEL,
  });

  const summarizerNode = new SummarizerNode({
    model: env.MINI_MODEL,
    temperature: 0.4,
  });

  const graph = new StateGraph(ShoppingState)
    .addNode("guardrail", guardrailNode.toNodeFn())
    .addNode("supervisor", supervisorNode.toNodeFn())
    .addNode("searchExplorer", searchExplorerNode.toNodeFn())
    .addNode("comparison", comparisonNode.toNodeFn())
    .addNode("offTopic", offTopicNode.toNodeFn())
    .addNode("summarize", summarizerNode.toNodeFn())
    .addEdge(START, "guardrail")
    .addConditionalEdges(
      "guardrail",
      (state: ShoppingStateType) => {
        return state.guardrailVerdict === "out_of_scope" ? "offTopic" : "supervisor";
      },
      { offTopic: "offTopic", supervisor: "supervisor" },
    )
    .addConditionalEdges(
      "supervisor",
      (state: ShoppingStateType) => {
        return state.route || "summarize";
      },
      {
        searchExplorer: "searchExplorer",
        comparison: "comparison",
        summarize: "summarize",
      },
    )
    .addEdge("searchExplorer", "supervisor")
    .addEdge("comparison", "supervisor")
    .addEdge("summarize", END)
    .addEdge("offTopic", END);

  return graph.compile({ checkpointer });
}
