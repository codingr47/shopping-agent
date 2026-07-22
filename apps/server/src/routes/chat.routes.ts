import { Router, Request, Response } from "express";
import { HumanMessage, AIMessageChunk } from "@langchain/core/messages";
import { createGraph } from "../graph/graph.js";
import { updateConversationUpdatedAt, updateConversationTitle, getConversation } from "../db/sqlite.js";
import { randomUUID } from "crypto";

const router = Router();

interface ChatRequest {
  content: string;
}

function encodeSSEEvent(event: string, data: any): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const nodeStatusLabels: Record<string, string> = {
  guardrail: "Understanding your request…",
  search: "Searching for products…",
  category: "Browsing categories…",
  detail: "Looking up product details…",
};

router.post("/:id/messages", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body as ChatRequest;

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "content is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const graph = createGraph();

    const config = {
      configurable: { thread_id: id },
      streamMode: ["updates", "messages"] as const,
    };

    let productResults: any[] | null = null;
    let categories: string[] | null = null;
    let offTopicMessageEmitted = false;

    try {
      const stream = await graph.stream(
        { messages: [new HumanMessage(content)] },
        config,
      );

      for await (const event of stream as any) {
        if (!Array.isArray(event) || event.length !== 2) continue;

        const [mode, payload] = event;

        if (mode === "updates") {
          if (!payload || typeof payload !== "object") continue;

          const entries = Object.entries(payload);
          if (entries.length === 0) continue;

          const [nodeName, delta] = entries[0] as [string, any];

          if (delta && typeof delta === "object") {
            if (nodeName === "offTopic" && delta.finalMessage && !offTopicMessageEmitted) {
              res.write(
                encodeSSEEvent("message", {
                  type: "text-delta",
                  text: delta.finalMessage,
                }),
              );
              offTopicMessageEmitted = true;
            } else if (nodeStatusLabels[nodeName]) {
              res.write(
                encodeSSEEvent("message", {
                  type: "status",
                  label: nodeStatusLabels[nodeName],
                }),
              );
            }

            if (delta.productResults) {
              productResults = delta.productResults;
            }

            if (delta.categories) {
              categories = delta.categories;
            }
          }
        } else if (mode === "messages") {
          if (!Array.isArray(payload) || payload.length < 2) continue;

          const [chunk, metadata] = payload;

          if (
            metadata &&
            typeof metadata === "object" &&
            metadata.langgraph_node === "summarize" &&
            chunk instanceof AIMessageChunk &&
            typeof chunk.content === "string" &&
            chunk.content.length > 0
          ) {
            res.write(
              encodeSSEEvent("message", {
                type: "text-delta",
                text: chunk.content,
              }),
            );
          }
        }
      }

      if (productResults && productResults.length > 0) {
        const widgetEvent = encodeSSEEvent("message", {
          type: "tool-call",
          toolCallId: randomUUID(),
          toolName: "render_products",
          args: {},
          result: { products: productResults },
        });
        res.write(widgetEvent);
      }

      const completeEvent = encodeSSEEvent("done", {});
      res.write(completeEvent);

      updateConversationUpdatedAt(id);

      const conversation = getConversation(id);
      if (conversation && conversation.title === "New conversation") {
        const title = content.length > 50 ? content.substring(0, 47) + "..." : content;
        updateConversationTitle(id, title);
      }

      res.end();
    } catch (streamError) {
      console.error("[chat.stream] Stream error:", streamError);
      res.write(encodeSSEEvent("error", { message: "Stream processing error" }));
      res.end();
    }
  } catch (error) {
    console.error("[chat.post] Error:", error);
    res.status(500).json({ error: "Failed to process message" });
  }
});

export default router;
