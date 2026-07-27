import { EvalExample } from "../lib/types.js";

export const shoppingJourneys: EvalExample[] = [
  {
    inputs: { prompt: "Find wireless headphones for me" },
    referenceOutputs: {
      expectedJourney: ["classify_intent:in_scope", "dispatch:search", "call_tool:search_products", "respond"],
      expectedFinalIntent: "search",
      requiredTools: ["search_products"],
      forbiddenTools: [],
    },
  },
  {
    inputs: { prompt: "Show me the beauty category" },
    referenceOutputs: {
      expectedJourney: ["classify_intent:in_scope", "dispatch:browse_category", "call_tool:list_categories", "respond"],
      expectedFinalIntent: "browse_category",
      requiredTools: ["list_categories"],
      forbiddenTools: [],
    },
  },
  {
    inputs: { prompt: "Tell me about product 5" },
    referenceOutputs: {
      expectedJourney: [
        "classify_intent:in_scope",
        "dispatch:product_detail",
        "call_tool:get_product_by_id",
        "respond",
      ],
      expectedFinalIntent: "product_detail",
      requiredTools: ["get_product_by_id"],
      forbiddenTools: [],
    },
  },
  {
    inputs: { prompt: "What's the weather today?" },
    referenceOutputs: {
      expectedJourney: ["classify_intent:out_of_scope", "respond_off_topic"],
      expectedFinalIntent: "out_of_scope",
      requiredTools: [],
      forbiddenTools: ["search_products", "list_categories", "get_product_by_id"],
    },
  },
  {
    inputs: { prompt: "Browse the electronics category and show me all products" },
    referenceOutputs: {
      expectedJourney: [
        "classify_intent:in_scope",
        "dispatch:browse_category",
        "call_tool:get_products_by_category",
        "respond",
      ],
      expectedFinalIntent: "browse_category",
      requiredTools: ["get_products_by_category"],
      forbiddenTools: [],
    },
  },
  {
    inputs: {
      prompt: "Search for blue sneakers but avoid anything related to weather forecasting",
    },
    referenceOutputs: {
      expectedJourney: ["classify_intent:in_scope", "dispatch:search", "call_tool:search_products", "respond"],
      expectedFinalIntent: "search",
      requiredTools: ["search_products"],
      forbiddenTools: [],
      forbiddenSteps: ["respond_off_topic"],
    },
  },
];
