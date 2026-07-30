import { EvalExample } from "../../../lib/types.js";

/**
 * These Prompts are all about a happy path of single api call interaction done through the agent in natural language- search
 */
export const singleJourneys: EvalExample[] = [
    {
        name: "Single-call-Search-by-query",
        inputs: {
            prompt: "Search for products with the word ketchup"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:search", "call_tool:search_products", "respond"],
            expectedFinalIntent: "search",
            forbiddenSteps: ["dispatch:browse_categories", "dispatch:browse_products"],
            forbiddenTools: ["list_categories", "list_products"],
            requiredTools: ["search_products"],
            expectedToolArgs: [{
                tool: "search_products",
                args: { q: "ketchup" },
            }]
        }
    },
    {
        name: "Single-call-Search-N-by-query",
        inputs: {
            prompt: "Search 7 products with starting with b"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:search", "call_tool:search_products", "respond"],
            expectedFinalIntent: "search",
            forbiddenSteps: ["dispatch:browse_categories", "dispatch:browse_products"],
            forbiddenTools: ["list_categories", "list_products"],
            requiredTools: ["search_products"],
            expectedToolArgs: [{
                tool: "search_products",
                args: { q: "b", limit: 7 },
            }]
        }
    },
      {
        name: "Single-call-Search-N-by-query-Skip-M",
        inputs: {
            prompt: "Search 7 products with starting with b (skip the first product)"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:search", "call_tool:search_products", "respond"],
            expectedFinalIntent: "search",
            forbiddenSteps: ["dispatch:browse_categories", "dispatch:browse_products"],
            forbiddenTools: ["list_categories", "list_products"],
            requiredTools: ["search_products"],
            expectedToolArgs: [{
                tool: "search_products",
                args: { q: "b", limit: 7, skip: 1 },
            }]
        }
    },
];