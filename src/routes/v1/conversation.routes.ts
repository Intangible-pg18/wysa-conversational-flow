import {Router} from "express";
import {ConversationController} from "../../controllers/conversation.controller.js"
import type { Repositories } from "../../infrastructure/wiring.js";
import { asyncHandler } from "../../middleware/async-handler.js";
import { ConversationService } from "../../application/services/conversation-service.js";
import { userContext } from "../../middleware/user-context-middleware.js";

export function conversationRoutes(repos: Repositories): Router {
    const router = Router();
    const service = new ConversationService(repos.modules, repos.userStates, repos.history);
    const controller = new ConversationController(service, repos);

    router.use(userContext);

    router.post("/modules/:moduleId/start", asyncHandler(controller.start));

    router.get("/modules/:moduleId/current", asyncHandler(controller.current));

    router.post("/modules/:moduleId/answer", asyncHandler(controller.answer));

    router.post("/modules/:moduleId/back", asyncHandler(controller.back));

    router.get("/deeplink", asyncHandler(controller.deepLink));

    router.get("/history", asyncHandler(controller.history));
    
    router.get("/state", asyncHandler(controller.state));

    return router;
}