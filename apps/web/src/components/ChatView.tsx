import { useState, useEffect, useRef } from "react";
import { ChatMessage, ProductSummary } from "@shopping-agent/shared";
import { ProductGrid } from "./product/ProductGrid.js";
import "./ChatView.css";

interface ChatViewProps {
  threadId: string | null;
}

export function ChatView({ threadId }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadId) {
      fetchMessages(threadId);
    } else {
      setMessages([]);
    }
  }, [threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      console.error("Failed to fetch messages:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !threadId) return;

    const messageText = input;
    const userMessage: ChatMessage = {
      role: "user",
      content: [{ type: "text", text: messageText }],
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`/api/conversations/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to send message");
      }

      const assistantContent: ChatMessage["content"] = [];
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "text") {
                assistantContent.push({ type: "text", text: data.text });
              } else if (data.type === "tool-call") {
                assistantContent.push({
                  type: "tool-call",
                  toolCallId: data.toolCallId,
                  toolName: data.toolName,
                  args: data.args,
                  result: data.result,
                });
              }
            } catch {
              continue;
            }
          }
        }
      }

      if (assistantContent.length > 0) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: assistantContent,
        };
        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error("Failed to get response:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!threadId) {
    return (
      <div className="chat-view empty-state">
        <div className="empty-content">
          <h2>No conversation selected</h2>
          <p>Create a new conversation or select one from the sidebar to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-view">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <div className="message-content">
              {msg.content.map((part, pIdx) => {
                if (part.type === "text" && "text" in part) {
                  return (
                    <p key={pIdx} className="text-part">
                      {(part as any).text}
                    </p>
                  );
                } else if (part.type === "tool-call" && (part as any).toolName === "render_products") {
                  return (
                    <ProductGrid
                      key={pIdx}
                      products={((part as any).result?.products as ProductSummary[]) || []}
                    />
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-input">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about products..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}
