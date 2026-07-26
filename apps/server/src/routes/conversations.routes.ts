import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
  updateConversationTitle,
} from "../db/sqlite.js";
import { createGraph } from "../graph/graph.js";
import { BaseMessage } from "@langchain/core/messages";
import { ChatMessage, ChatMessageContentPart } from "@shopping-agent/shared";
import { TurnWidget } from "../graph/state.js";
import { logger } from "../logger.js";

const router = Router();

function convertMessages(messages: BaseMessage[]): ChatMessage[] {
  return messages.map(msg => {
    const role = msg.getType() === "human" ? ("user" as const) : ("assistant" as const);

    let content: ChatMessageContentPart[] = [];

    if (typeof msg.content === "string") {
      content = [{ type: "text", text: msg.content }];
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (typeof part === "string") {
          content.push({ type: "text", text: part });
        } else if (typeof part === "object" && part && "type" in part && part.type === "text" && "text" in part) {
          content.push({ type: "text", text: (part as any).text || "" });
        }
      }
    }

    if (content.length === 0) {
      content = [{ type: "text", text: "" }];
    }

    return { role, content };
  });
}

router.get("/", (req: Request, res: Response) => {
  const log = logger.child({ requestId: randomUUID(), route: "list_conversations" });
  try {
    const conversations = listConversations();
    log.debug({ event: "list.success", count: conversations.length }, "conversations listed");
    res.json(conversations);
  } catch (error) {
    log.error({ event: "list.error", err: error }, "list conversations failed");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/", (req: Request<{}, {}, {}>, res: Response) => {
  const log = logger.child({ requestId: randomUUID(), route: "create_conversation" });
  try {
    const id = randomUUID();
    const conversation = createConversation(id);
    log.debug({ event: "create.success", conversationId: id }, "conversation created");
    res.json(conversation);
  } catch (error) {
    log.error({ event: "create.error", err: error }, "create conversation failed");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  const log = logger.child({ requestId: randomUUID(), route: "get_conversation", conversationId: req.params.id });
  try {
    const { id } = req.params;
    const conversation = getConversation(id);

    if (!conversation) {
      log.warn({ event: "get.not_found", conversationId: id }, "conversation not found");
      return res.status(404).json({ error: "Conversation not found" });
    }

    const graph = createGraph();
    const state = await graph.getState({ configurable: { thread_id: id } });

    if (!state || !state.values) {
      log.debug({ event: "get.empty_state", conversationId: id }, "no state in checkpointer");
      return res.json({ ...conversation, messages: [] });
    }

    const messages = (state.values?.messages || []) as BaseMessage[];
    const chatMessages = convertMessages(messages);

    const turnWidgets = (state.values?.turnWidgets || []) as TurnWidget[];
    for (const widget of turnWidgets) {
      if (chatMessages[widget.turnIndex]) {
        chatMessages[widget.turnIndex].content.push({
          type: "tool-call",
          toolCallId: randomUUID(),
          toolName: "render_products",
          args: {},
          result: { products: widget.products },
        });
      }
    }

    log.debug(
      { event: "get.success", messageCount: chatMessages.length, widgetCount: turnWidgets.length },
      "conversation reconstructed",
    );
    log.debug(
      { event: "get.end", conversationId: id, messageCount: chatMessages.length },
      "conversation retrieved",
    );

    res.json({
      ...conversation,
      messages: chatMessages,
    });
  } catch (error) {
    log.error({ event: "get.error", err: error }, "fetch conversation failed");
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

router.delete("/:id", (req: Request, res: Response) => {
  const log = logger.child({ requestId: randomUUID(), route: "delete_conversation", conversationId: req.params.id });
  try {
    const { id } = req.params;
    deleteConversation(id);
    log.debug({ event: "delete.success", conversationId: id }, "conversation deleted");
    res.json({ success: true });
  } catch (error) {
    log.error({ event: "delete.error", err: error, conversationId: req.params.id }, "delete conversation failed");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;
