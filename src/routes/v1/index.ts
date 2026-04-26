import { Router } from "express";
import type { Repositories } from "../../infrastructure/wiring.js";
import { conversationRoutes } from "./conversation.routes.js";

export function v1Routes(repos: Repositories): Router {
    const router = Router();
    router.use(conversationRoutes(repos));
    return router;
}