import { EvalExample } from "../../lib/types.js";

/**
 * These Prompts are all about a happy path of single api call interaction done through the agent in natural language 
 */
export const singleJourneys: EvalExample[] = [
    {
        name: "Single-call-to-Get-A-List-Of-Products-No-Filters",
        inputs: {
            prompt: "Show me all products"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:browse_products", "call_tool:list_products", "respond"],
            expectedFinalIntent: "browse_products",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["list_products"],
            expectedToolArgs: [{
                tool: "list_products",
                args: {},
            }]
        }
    }
];