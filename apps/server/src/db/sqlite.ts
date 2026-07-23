import Database from "better-sqlite3";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { join, dirname } from "path";
import fs from "fs";
import { env } from "../env.js";
import { logger } from "../logger.js";

let _db: Database.Database | null = null;
let _checkpointer: SqliteSaver | null = null;

export function initializeDatabase(): {
  db: Database.Database;
  checkpointer: SqliteSaver;
} {
  if (_db && _checkpointer) {
    return { db: _db, checkpointer: _checkpointer };
  }

  const dbPath = env.SQLITE_PATH;
  const dbDir = dirname(dbPath);

  // Create data directory if it doesn't exist
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new Database(dbPath);

  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");

  _checkpointer = new SqliteSaver(_db);
  (_checkpointer as any).setup?.();

  createConversationsTable(_db);

  logger.info({ dbPath }, "sqlite initialized");

  return { db: _db, checkpointer: _checkpointer };
}

function createConversationsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'New conversation',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
      ON conversations(updated_at DESC);
  `);
}

export function getDatabase(): Database.Database {
  if (!_db) {
    throw new Error("Database not initialized. Call initializeDatabase() first.");
  }
  return _db;
}

export function getCheckpointer(): SqliteSaver {
  if (!_checkpointer) {
    throw new Error("Checkpointer not initialized. Call initializeDatabase() first.");
  }
  return _checkpointer;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export function createConversation(id: string, title: string = "New conversation"): Conversation {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare(
    "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
  );
  stmt.run(id, title, now, now);

  return {
    id,
    title,
    created_at: now,
    updated_at: now,
  };
}

export function getConversation(id: string): Conversation | null {
  const db = getDatabase();
  const stmt = db.prepare("SELECT * FROM conversations WHERE id = ?");
  return (stmt.get(id) as Conversation | undefined) ?? null;
}

export function listConversations(): Conversation[] {
  const db = getDatabase();
  const stmt = db.prepare(
    "SELECT * FROM conversations ORDER BY updated_at DESC",
  );
  return stmt.all() as Conversation[];
}

export function updateConversationTitle(id: string, title: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
  );
  stmt.run(title, now, id);
}

export function updateConversationUpdatedAt(id: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?");
  stmt.run(now, id);
}

export function deleteConversation(id: string): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM conversations WHERE id = ?");
  stmt.run(id);
}
