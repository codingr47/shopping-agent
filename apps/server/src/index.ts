import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../../..");
const envPath = join(rootDir, ".env");

const envExists = fs.existsSync(envPath);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error(`[dotenv] Failed to load ${envPath}: ${result.error.message}`);
} else {
  console.log(`[dotenv] Loaded from ${envPath}`);
}

async function main() {
  const express = (await import("express")).default;
  const pinoHttp = (await import("pino-http")) as any;
  const { initializeDatabase } = await import("./db/sqlite.js");
  const { initializeMcpClient } = await import("./mcp/client.js");
  const { env } = await import("./env.js");
  const { logger } = await import("./logger.js");
  const conversationsRouter = (await import("./routes/conversations.routes.js")).default;
  const chatRouter = (await import("./routes/chat.routes.js")).default;

  const app = express();

  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  logger.info("initializing database");
  initializeDatabase();

  logger.info("connecting to MCP server");
  await initializeMcpClient();

  logger.info("mounting routes");
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/conversations", chatRouter);

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const port = env.PORT;
  app.listen(port, () => {
    logger.info({ port }, "server listening");
  });
}

main().catch(err => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});
