import {env} from "./config/env.js";
import {logger} from "./config/logger.js";
import {connectToDatabase, disconnectFromDatabase} from "./infrastructure/db/mongo.js";

async function bootstrap() {
    await connectToDatabase();
    logger.info({port: env.PORT}, "Service ready");
}

async function shutdown(signal: string) {
    logger.info({signal}, "Shutting down");
    await disconnectFromDatabase();
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

bootstrap().catch((err) => {
    logger.error({ err }, "Bootstrap failed");
    process.exit(1);
})