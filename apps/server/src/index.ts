import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../../..");
const envPath = join(rootDir, ".env");

console.log(`[dotenv] Loading from: ${envPath}`);
console.log(`[dotenv] File exists: ${fs.existsSync(envPath)}`);

const result = dotenv.config({ path: envPath });
console.log(`[dotenv] Result: ${result.error ? `ERROR: ${result.error.message}` : `OK`}`);

async function main() {
  const express = (await import("express")).default;
  const { initializeDatabase } = await import("./db/sqlite.js");
  const { initializeMcpClient } = await import("./mcp/client.js");
  const { env } = await import("./env.js");
  const conversationsRouter = (await import("./routes/conversations.routes.js")).default;
  const chatRouter = (await import("./routes/chat.routes.js")).default;

  const app = express();

  app.use(express.json());
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  console.log("[server] Initializing database...");
  initializeDatabase();

  console.log("[server] Connecting to MCP server...");
  await initializeMcpClient();

  console.log("[server] Mounting routes...");
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/conversations", chatRouter);

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const port = env.PORT;
  app.listen(port, () => {
    console.log(`[server] Listening on port ${port}`);
  });
}

main().catch(err => {
  console.error("[server] Fatal error:", err);
  process.exit(1);
});
