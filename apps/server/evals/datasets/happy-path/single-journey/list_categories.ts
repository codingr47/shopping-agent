import { EvalExample } from "../../../lib/types.js";

/**
 * These Prompts are all about a happy path of single api call interaction done through the agent in natural language- list categories
 */
export const singleJourneys: EvalExample[] = [
    {
        name: "Single-call-to-Get-A-List-Of-Categories",
        inputs: {
            prompt: "Show me all categories"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:browse_categories", "call_tool:list_categories", "respond"],
            expectedFinalIntent: "browse_categories",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["list_categories"],
            expectedToolArgs: [{
                tool: "list_categories",
                args: {},
            }]
        }
    },
    {
        name: "Single-call-to-Get-A-List-Of-Categories-Flavor2",
        inputs: {
            prompt: "I would like to explore which categories are available"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:browse_categories", "call_tool:list_categories", "respond"],
            expectedFinalIntent: "browse_categories",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["list_categories"],
            expectedToolArgs: [{
                tool: "list_categories",
                args: {},
            }]
        }
    },
    {
        name: "Single-call-to-Get-A-List-Of-Categories-Flavor3",
        inputs: {
            prompt: "What categories can I shop from?"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:in_scope", "dispatch:browse_categories", "call_tool:list_categories", "respond"],
            expectedFinalIntent: "browse_categories",
            forbiddenSteps: ["dispatch:search"],
            forbiddenTools: ["search"],
            requiredTools: ["list_categories"],
            expectedToolArgs: [{
                tool: "list_categories",
                args: {},
            }]
        }
    }
];