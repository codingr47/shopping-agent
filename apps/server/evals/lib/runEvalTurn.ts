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
      if (!Array.isArray(event) || event.length !== 2) continue;

      const [nodeName, delta] = event;

      if (delta && typeof delta === "object") {
        // Guardrail verdict
        if (nodeName === "guardrail" && delta.guardrailVerdict) {
          journey.push(`classify_intent:${delta.guardrailVerdict}`);
        }

        // Supervisor dispatch
        if (nodeName === "supervisor" && delta.route === "searchExplorer" && delta.currentIntent) {
          journey.push(`dispatch:${delta.currentIntent.type}`);
          if (firstDispatch) {
            selectedIntent = delta.currentIntent.type;
            firstDispatch = false;
          }
        }

        // Tool calls from searchExplorer
        if (nodeName === "searchExplorer" && delta.messages) {
          const messages = Array.isArray(delta.messages) ? delta.messages : [delta.messages];
          for (const msg of messages) {
            if (msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0) {
              const toolCall = msg.tool_calls[0];
              journey.push(`call_tool:${toolCall.name}`);
              toolCalls.push({
                name: toolCall.name,
                args: toolCall.args,
              });
            }
          }
        }

        // Final response from summarizer
        if (nodeName === "summarize" && delta.finalMessage) {
          finalResponse = delta.finalMessage;
          journey.push("respond");
        }

        // Off-topic response
        if (nodeName === "offTopic" && delta.finalMessage) {
          finalResponse = delta.finalMessage;
          journey.push("respond_off_topic");
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
