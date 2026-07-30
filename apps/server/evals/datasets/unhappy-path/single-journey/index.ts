import { EvalExample } from "../../../lib/types.js";

/**
 * These Prompts are all about a out of scope prompting
 */
export const singleJourneys: EvalExample[] = [
    {
        name: "Single-Out-Of-Scope1",
        inputs: {
            prompt: "What is the weather?"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:out_of_scope", "respond_off_topic"],
            expectedFinalIntent: undefined,
        }
    },
    {
        name: "Single-Out-Of-Scope2",
        inputs: {
            prompt: "What is the meaning of life?"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:out_of_scope", "respond_off_topic"],
            expectedFinalIntent: undefined,
        }
    },
    {
        name: "Single-Out-Of-Scope3",
        inputs: {
            prompt: "What is the dot product of (5, 4) and (4, 5)?"
        },
        referenceOutputs: {
            expectedJourney: ["classify_intent:out_of_scope", "respond_off_topic"],
            expectedFinalIntent: undefined,
        }
    },
];