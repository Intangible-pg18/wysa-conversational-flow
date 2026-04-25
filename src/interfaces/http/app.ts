import express, {type Express, type Request, type Response, type NextFunction} from "express";
import helmet from "helmet";
import cors from "cors"
import {randomUUID} from "node:crypto"
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js"
import { getDb } from "../../infrastructure/db/mongo.js";

export function createApp():Express {
    const app = express();
    app.use(helmet());
    app.use(cors({origin: env.CORS_ORIGIN}));
    app.use(express.json());

    //for correlation-id
    app.use((req: Request, res: Response, next: NextFunction) => {
        const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();
        res.setHeader("x-request-id", requestId);
        (req as Request& {id: string}).id = requestId;
        const start = Date.now();
        logger.debug({requestId, method: req.method, path: req.path}, "request received");

        req.on("finish", () => {
           logger.info({requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - start}, "request completed");
        });
        next();
    });

    app.get("/healthz", async (_req, res) => {
        try {
            await getDb().command({ping: 1});
            res.json({ status: "ok", db: "ok" });
        } 
        catch (err) {
            logger.error({ err }, "health check failed");
            res.status(500).json({ status: "failed", db: "unreachable" });
        }
    });

    app.use((req, res) => {
        res.status(404).json({ error: "not_found", path: req.path });
    });
    
    app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
        const requestId = (req as Request & { id?: string }).id;
        logger.error({ err, requestId }, "unhandled error in request");
        res.status(500).json({ error: "internal_error", requestId });
    });

    return app;
}