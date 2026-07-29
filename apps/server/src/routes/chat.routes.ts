import { Router, Request, Response } from "express";
import { HumanMessage, AIMessageChunk } from "@langchain/core/messages";
import { createGraph } from "../graph/graph.js";
import { updateConversationUpdatedAt, updateConversationTitle, getConversation } from "../db/sqlite.js";
import { randomUUID } from "crypto";
import { logger } from "../logger.js";
import { type ShoppingStateType } from "../graph/state.js";
import { TurnWidget } from "../graph/state.js";

const router = Router();

interface ChatRequest {
  content: string;
}

function encodeSSEEvent<T>(event: string, data: T): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const nodeStatusLabels: Record<string, string> = {
  guardrail: "Understanding your request…",
};

const intentStatusLabels: Record<string, string> = {
  search: "Searching for products…",
  browse_category: "Browsing categories…",
  product_detail: "Looking up product details…",
  comparison: "Comparing products…",
};

router.post("/:id/messages", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content } = req.body as ChatRequest;
  const requestId = randomUUID();
  const log = logger.child({ requestId, conversationId: id });

  try {
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "content is required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const graph = createGraph();
    const turnId = randomUUID();

    type GraphStreamOptions = Parameters<typeof graph.stream>[1];
    const config: GraphStreamOptions = {
      configurable: { thread_id: id, requestId },
      streamMode: ["updates", "messages"],
    };

    const collectedWidgets: TurnWidget[] = [];
    let offTopicMessageEmitted = false;

    log.debug({ event: "request.start", method: "POST", path: `/api/conversations/${id}/messages` }, "chat message received");

    const streamStart = performance.now();
    let chunkCount = 0;

    try {
      const stream = await graph.stream(
        { messages: [new HumanMessage(content)], turnId },
        config,
      );

      log.debug({ event: "stream.start" }, "starting SSE stream");

      for await (const event of stream as AsyncIterable<[string, unknown]>) {
        if (!Array.isArray(event) || event.length !== 2) continue;

        const [mode, payload] = event;
        chunkCount++;

        if (mode === "updates") {
          if (!payload || typeof payload !== "object") continue;

          const entries = Object.entries(payload);
          if (entries.length === 0) continue;

          const [nodeName, delta] = entries[0] as [string, Partial<ShoppingStateType>];

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
            } else if (nodeName === "supervisor" && delta.route && delta.route !== "summarize" && delta.currentIntent && delta.currentIntent.type) {
              const intentLabel = intentStatusLabels[delta.currentIntent.type];
              if (intentLabel) {
                res.write(
                  encodeSSEEvent("message", {
                    type: "status",
                    label: intentLabel,
                  }),
                );
              }
            }

            if (delta.turnWidgets) {
              collectedWidgets.push(...delta.turnWidgets);
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

      for (const widget of collectedWidgets) {
        const widgetEvent = encodeSSEEvent("message", {
          type: "tool-call",
          toolCallId: randomUUID(),
          toolName: "render_products",
          args: {},
          result: { products: widget.products },
        });
        res.write(widgetEvent);
      }

      const completeEvent = encodeSSEEvent("done", {});
      res.write(completeEvent);

      const streamDuration = Math.round(performance.now() - streamStart);
      log.debug(
        { event: "stream.end", durationMs: streamDuration, chunkCount, widgetCount: collectedWidgets.length },
        "SSE stream completed",
      );

      updateConversationUpdatedAt(id);

      const conversation = getConversation(id);
      if (conversation && conversation.title === "New conversation") {
        const title = content.length > 50 ? content.substring(0, 47) + "..." : content;
        updateConversationTitle(id, title);
        res.write(encodeSSEEvent("message", { type: "title-update", threadId: id, title }));
      }

      const totalDuration = Math.round(performance.now() - streamStart);
      log.debug({ event: "request.end", durationMs: totalDuration, status: 200 }, "chat turn complete");

      res.end();
    } catch (streamError) {
      log.error({ event: "stream.error", err: streamError }, "SSE stream failed");
      res.write(encodeSSEEvent("error", { message: "Stream processing error" }));
      res.end();
    }
  } catch (error) {
    log.error({ event: "request.error", err: error }, "chat message handling failed");
    res.status(500).json({ error: "Failed to process message" });
  }
});

export default router;
