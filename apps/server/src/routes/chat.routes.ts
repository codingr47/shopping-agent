import { Router, Request, Response } from "express";
import { HumanMessage } from "@langchain/core/messages";
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
      streamMode: "updates" as const,
    };

    let messagesSent = false;
    let productResults: any[] | null = null;
    let finalMessage = "";

    try {
      const stream = await graph.stream(
        { messages: [new HumanMessage(content)] },
        config,
      );

      for await (const event of stream as any) {
        const nodeOutput = event;

        if (nodeOutput && typeof nodeOutput === "object") {
          if ("finalMessage" in nodeOutput && nodeOutput.finalMessage) {
            finalMessage = nodeOutput.finalMessage;
            const textEvent = encodeSSEEvent("message", {
              type: "text",
              text: nodeOutput.finalMessage,
            });
            res.write(textEvent);
            messagesSent = true;
          }

          if ("productResults" in nodeOutput && nodeOutput.productResults) {
            productResults = nodeOutput.productResults;
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
