import { StateGraph, START, END } from "@langchain/langgraph";
import { ShoppingState, type ShoppingStateType } from "./state.js";
import { GuardrailIntentClassifierNode } from "./nodes/guardrailIntentClassifier.node.js";
import { SupervisorNode } from "./nodes/supervisor.node.js";
import { ProductSearchNode } from "./nodes/productSearch.node.js";
import { CategoryNode } from "./nodes/category.node.js";
import { ProductDetailNode } from "./nodes/productDetail.node.js";
import { OffTopicResponderNode } from "./nodes/offTopic.node.js";
import { SummarizerNode } from "./nodes/summarizer.node.js";
import { getCheckpointer } from "../db/sqlite.js";
import { env } from "../env.js";

export function createGraph() {
  const guardrailNode = new GuardrailIntentClassifierNode({
    model: env.NANO_MODEL,
    temperature: 0,
    seed: 7,
  });

  const supervisorNode = new SupervisorNode({
    model: env.MINI_MODEL,
  });

  const searchNode = new ProductSearchNode({
    model: env.NANO_MODEL,
  });

  const categoryNode = new CategoryNode({
    model: env.NANO_MODEL,
  });

  const detailNode = new ProductDetailNode({
    model: env.NANO_MODEL,
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
    .addNode("search", searchNode.toNodeFn())
    .addNode("category", categoryNode.toNodeFn())
    .addNode("detail", detailNode.toNodeFn())
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
        search: "search",
        category: "category",
        detail: "detail",
        summarize: "summarize",
      },
    )
    .addEdge("search", "summarize")
    .addEdge("category", "summarize")
    .addEdge("detail", "summarize")
    .addEdge("summarize", END)
    .addEdge("offTopic", END);

  const checkpointer = getCheckpointer();
  return graph.compile({ checkpointer });
}
