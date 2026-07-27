import { useState, useRef } from "react";
import { Sidebar, SidebarHandle } from "./components/Sidebar.js";
import { ChatView } from "./components/ChatView.js";
import "./App.css";

export default function App() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const sidebarRef = useRef<SidebarHandle>(null);

  return (
    <div className="app-layout">
      <Sidebar ref={sidebarRef} onSelectThread={setThreadId} />
      <ChatView
        threadId={threadId}
        onTitleUpdate={(id, title) => sidebarRef.current?.updateConversationTitle(id, title)}
      />
    </div>
  );
}
