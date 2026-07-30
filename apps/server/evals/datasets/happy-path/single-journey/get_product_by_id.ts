import { EvalExample } from "../../../lib/types.js";

/**
 * These Prompts are all about a happy path of single api call interaction done through the agent in natural language- get product by id
 */
export const singleJourneys: EvalExample[] = [
    {
        name: "Single-call-to-Get-A-Product-By-Id",
        inputs: {
            prompt: "Show me product by id 51"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:product_detail", "call_tool:get_product_by_id", "respond"],
            expectedFinalIntent: "product_detail",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["get_product_by_id"],
            expectedToolArgs: [{
                tool: "get_product_by_id",
                args: { id: 51 },
            }]
        }
    },
    {
        name: "Single-call-to-Get-A-Product-By-Id-Flavor2",
        inputs: {
            prompt: "Show me product 10"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:product_detail", "call_tool:get_product_by_id", "respond"],
            expectedFinalIntent: "product_detail",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["get_product_by_id"],
            expectedToolArgs: [{
                tool: "get_product_by_id",
                args: { id: 10 },
            }]
        }
    },
    {
        name: "Single-call-to-Get-A-Product-By-Id-Flavor3",
        inputs: {
            prompt: "Get product number 21"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:product_detail", "call_tool:get_product_by_id", "respond"],
            expectedFinalIntent: "product_detail",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["get_product_by_id"],
            expectedToolArgs: [{
                tool: "get_product_by_id",
                args: { id: 21 },
            }]
        }
    },
];