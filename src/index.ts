import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import {connectToDatabase, disconnectFromDatabase} from "./infrastructure/db/mongo.js";
import { createApp } from "./interfaces/http/app.js"
import type { Server } from "node:http";

let server: Server | null = null;

async function bootstrap() {
  await connectToDatabase();

  const app = createApp();
  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "HTTP server listening");
  });
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((err) => (err ? reject(err) : resolve()));
    });
  }
  await disconnectFromDatabase();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

bootstrap().catch((err) => {
  logger.error({ err }, "Bootstrap failed");
  process.exit(1);
});