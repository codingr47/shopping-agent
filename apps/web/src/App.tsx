import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar.js";
import { ChatView } from "./components/ChatView.js";
import "./App.css";

export default function App() {
  const [threadId, setThreadId] = useState<string | null>(null);

  return (
    <div className="app-layout">
      <Sidebar onSelectThread={setThreadId} />
      <ChatView threadId={threadId} />
    </div>
  );
}
