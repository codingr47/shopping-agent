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
  try {
    const conversations = listConversations();
    res.json(conversations);
  } catch (error) {
    console.error("[conversations.get] Error:", error);
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/", (req: Request<{}, {}, {}>, res: Response) => {
  try {
    const id = randomUUID();
    const conversation = createConversation(id);
    res.json(conversation);
  } catch (error) {
    console.error("[conversations.post] Error:", error);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const conversation = getConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const graph = createGraph();
    const state = await graph.getState({ configurable: { thread_id: id } });

    if (!state || !state.values) {
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

    res.json({
      ...conversation,
      messages: chatMessages,
    });
  } catch (error) {
    console.error("[conversations.get:id] Error:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

router.delete("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    deleteConversation(id);
    res.json({ success: true });
  } catch (error) {
    console.error("[conversations.delete] Error:", error);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

export default router;
