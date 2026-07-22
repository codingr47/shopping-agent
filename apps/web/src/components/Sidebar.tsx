import { useState, useEffect } from "react";
import { ConversationSummary } from "@shopping-agent/shared";
import "./Sidebar.css";

interface SidebarProps {
  onSelectThread: (threadId: string) => void;
}

export function Sidebar({ onSelectThread }: SidebarProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
  };

  const handleNewConversation = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/conversations", { method: "POST" });
      const data = await res.json();
      setSelectedId(data.id);
      onSelectThread(data.id);
      await fetchConversations();
    } catch (err) {
      console.error("Failed to create conversation:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    setSelectedId(id);
    onSelectThread(id);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-title">Shopping Agent</h1>
        <button
          className="new-thread-btn"
          onClick={handleNewConversation}
          disabled={loading}
          title="Start a new conversation"
        >
          ＋
        </button>
      </div>

      <div className="sidebar-content">
        {conversations.length > 0 ? (
          <div className="threads-list">
            {conversations.map(conv => (
              <button
                key={conv.id}
                className={`thread-item ${selectedId === conv.id ? "active" : ""}`}
                onClick={() => handleSelectConversation(conv.id)}
                title={conv.title}
              >
                <span className="thread-item-title">{conv.title}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="sidebar-empty">
            No conversations yet. Start a new one!
          </div>
        )}
      </div>
    </div>
  );
}
