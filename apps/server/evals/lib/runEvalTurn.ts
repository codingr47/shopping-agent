import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { randomUUID } from "crypto";
import { createGraph } from "../../src/graph/graph.js";
import { initializeMcpClient } from "../../src/mcp/client.js";
import { EvaluationOutput } from "./types.js";

let mcpInitialized = false;

export async function runEvalTurn(prompt: string): Promise<EvaluationOutput> {
  if (!mcpInitialized) {
    await initializeMcpClient();
    mcpInitialized = true;
  }
  const graph = createGraph(new MemorySaver());
  const turnId = randomUUID();
  const threadId = randomUUID();

  const config: any = {
    configurable: { thread_id: threadId, requestId: turnId },
    streamMode: ["updates"],
  };

  const startTime = performance.now();
  const journey: string[] = [];
  let finalResponse = "";
  let selectedIntent: string | undefined;
  let firstDispatch = true;
  const toolCalls: Array<{ name: string; args: unknown }> = [];

  try {
    const stream = await graph.stream(
      { messages: [new HumanMessage(prompt)], turnId },
      config,
    );

    for await (const event of stream as any) {
      if (!Array.isArray(event) || event.length < 2) continue;

      // Event format: ["updates", {nodeName: {nodeUpdates}}]
      const [mode, delta] = event;
      if (mode !== "updates" || !delta || typeof delta !== "object") continue;

      // delta is {nodeName: {...updates...}, ...otherNodes...}
      const entries = Object.entries(delta) as [string, any][];
      for (const [nodeName, nodeUpdate] of entries) {
        // Guardrail verdict
        if (nodeName === "guardrail" && nodeUpdate.guardrailVerdict) {
          journey.push(`classify_intent:${nodeUpdate.guardrailVerdict}`);
        }

        // Supervisor dispatch
        if (nodeName === "supervisor") {
          if (nodeUpdate.route && nodeUpdate.route !== "summarize" && nodeUpdate.currentIntent) {
            journey.push(`dispatch:${nodeUpdate.currentIntent.type}`);
            if (firstDispatch) {
              selectedIntent = nodeUpdate.currentIntent.type;
              firstDispatch = false;
            }
          }
        }

        // Tool calls from searchExplorer
        if (nodeName === "searchExplorer") {
          if (nodeUpdate.messages && Array.isArray(nodeUpdate.messages)) {
            for (const msg of nodeUpdate.messages) {
              if (msg && msg.tool_calls && Array.isArray(msg.tool_calls)) {
                for (const toolCall of msg.tool_calls) {
                  if (toolCall.name) {
                    journey.push(`call_tool:${toolCall.name}`);
                    toolCalls.push({
                      name: toolCall.name,
                      args: toolCall.args || {},
                    });
                  }
                }
              }
            }
          }
        }

        // Final response from summarizer
        if (nodeName === "summarize" && nodeUpdate.finalMessage) {
          finalResponse = nodeUpdate.finalMessage;
          if (!journey.includes("respond")) {
            journey.push("respond");
          }
        }

        // Off-topic response
        if (nodeName === "offTopic" && nodeUpdate.finalMessage) {
          finalResponse = nodeUpdate.finalMessage;
          if (!journey.includes("respond_off_topic")) {
            journey.push("respond_off_topic");
          }
        }
      }
    }
  } catch (error) {
    console.error("Error running eval turn:", error);
    throw error;
  }

  const latencyMs = Math.round(performance.now() - startTime);

  return {
    finalResponse,
    journey,
    selectedIntent,
    toolCalls,
    latencyMs,
  };
}
