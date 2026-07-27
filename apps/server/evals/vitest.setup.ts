import dotenv from "dotenv";
import path from "path";

process.env.NODE_ENV = "test";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
