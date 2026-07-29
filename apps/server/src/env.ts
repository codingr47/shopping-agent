import { z } from "zod";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  const altPath = path.resolve(process.cwd(), "../.env");
  if (fs.existsSync(altPath)) {
    dotenv.config({ path: altPath });
  } else {
    const rootPath = path.resolve(process.cwd(), "../../.env");
    if (fs.existsSync(rootPath)) {
      dotenv.config({ path: rootPath });
    }
  }
}

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  NANO_MODEL: z.string().default("gpt-5.4-nano"),
  MINI_MODEL: z.string().default("gpt-5.4-mini"),
  PORT: z
    .string()
    .default("3001")
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  SQLITE_PATH: z.string().default("./data/app.db"),
  MCP_SERVER_CMD: z.string().default("npx"),
  MCP_SERVER_ARGS: z.string().default("tsx,../mcp-server/src/index.ts"),
  VITE_SERVER_URL: z.string().default("http://localhost:3001"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  MAX_CONTEXT_SIZE: z
    .string()
    .default("8000")
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().positive()),
});

export type Environment = z.infer<typeof envSchema>;

export function loadEnv(): Environment {
  const env = process.env;
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    console.error("Environment validation failed:");
    console.error(parsed.error.flatten());
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
