import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Server } from "node:http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import {connectToDatabase, disconnectFromDatabase} from "./infrastructure/db/mongo.js";
import { ensureIndexes, wireRepositories } from "./infrastructure/wiring.js";
import { seedModules } from "./infrastructure/seed/module-seeder.js";
import { createApp } from "./interfaces/http/app.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = resolve(__dirname, "../data/modules");

let server: Server | null = null;

async function bootstrap() {
  const db = await connectToDatabase();
  await ensureIndexes(db);
  const repos = wireRepositories(db);
  const seeded = await seedModules(MODULES_DIR, repos.modules);
  logger.info({ seeded, modulesDir: MODULES_DIR }, "Module seed complete");
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