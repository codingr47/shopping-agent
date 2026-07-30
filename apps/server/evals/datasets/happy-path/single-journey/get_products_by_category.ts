import { EvalExample } from "../../../lib/types.js";

/**
 * These Prompts are all about a happy path of single api call interaction done through the agent in natural language- get products by category
 */
export const singleJourneys: EvalExample[] = [
    {
        name: "Single-call-to-Get-A-List-Of-Products-By-Category",
        inputs: {
            prompt: "Show me all products for category beauty"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:browse_products_by_category", "call_tool:get_products_by_category", "respond"],
            expectedFinalIntent: "browse_products_by_category",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["get_products_by_category"],
            expectedToolArgs: [{
                tool: "get_products_by_category",
                args: { slug: "beauty" },
            }]
        }
    },
    {
        name: "Single-call-to-Get-A-List-Of-Products-By-Category-And-Skip-32",
        inputs: {
            prompt: "Show me all products for category beauty, skip the first 32"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:browse_products_by_category", "call_tool:get_products_by_category", "respond"],
            expectedFinalIntent: "browse_products_by_category",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["get_products_by_category"],
            expectedToolArgs: [{
                tool: "get_products_by_category",
                args: { slug: "beauty", skip: 32 },
            }]
        }
    },
    {
        name: "Single-call-to-Get-A-List-Of-11-Products-By-Category-And-Skip-31",
        inputs: {
            prompt: "Show me 11 products for category beauty, skip the first 31"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:browse_products_by_category", "call_tool:get_products_by_category", "respond"],
            expectedFinalIntent: "browse_products_by_category",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["get_products_by_category"],
            expectedToolArgs: [{
                tool: "get_products_by_category",
                args: { slug: "beauty", skip: 31, limit: 11 },
            }]
        }
    },
];