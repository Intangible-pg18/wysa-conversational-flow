import type {Request, Response} from "express"
import {COMPLETED_RECENT_DAYS, daysSince} from "../domain/constants.js";
import {asModuleId, asOptionId, asQuestionId, type UserModuleState} from "../domain/entities.js";
import type {ConversationService} from "../application/services/conversation-service.js"
import type { Repositories } from "../infrastructure/wiring.js";
import {answerBodySchema, deepLinkQuerySchema, historyQuerySchema, moduleParamsSchema} from "../validators/conversation.validators.js"
import {parseOrThrow} from "../validators/parse.js"

export class ConversationController {
    constructor (private readonly service: ConversationService, private readonly repos: Repositories) {}

    start = async (req: Request, res: Response) => {
        const {moduleId} = parseOrThrow(moduleParamsSchema, req.params);
        const outcome= await this.service.start(req.userId!, asModuleId(moduleId));
        res.json(this.toResponseBody(outcome));
    }

    current = async (req: Request, res: Response) => {
        const {moduleId} = parseOrThrow(moduleParamsSchema, req.params);
        const outcome = await this.service.getCurrent(req.userId!, asModuleId(moduleId));
        res.json(this.toResponseBody(outcome));
    }

    answer = async(req: Request, res: Response) => {
        const {moduleId} = parseOrThrow(moduleParamsSchema, req.params);
        const {questionId, optionId} = parseOrThrow(answerBodySchema, req.body);
        const outcome = await this.service.answer(req.userId!, asModuleId(moduleId), asQuestionId(questionId), asOptionId(optionId));
        res.json(this.toResponseBody(outcome));
    }

    back = async(req: Request, res: Response) => {
        const {moduleId} = parseOrThrow(moduleParamsSchema, req.params);
        const outcome = await this.service.back(req.userId!, asModuleId(moduleId));
        res.json(this.toResponseBody(outcome));
    }

    deepLink = async(req: Request, res: Response) => {
        const { moduleId, questionId } = parseOrThrow(deepLinkQuerySchema, req.query);
        const outcome = await this.service.resolveDeepLink(req.userId!, asModuleId(moduleId), asQuestionId(questionId));
        res.json(this.toResponseBody(outcome));
    }

    history = async (req: Request, res: Response) => {
        const { moduleId, limit, before } = parseOrThrow(historyQuerySchema, req.query);
        const entries = moduleId
            ? await this.repos.history.findByUserAndModule(req.userId!, asModuleId(moduleId), {limit, before})
            : await this.repos.history.findByUser(req.userId!, {limit, before});
        res.json({ entries });
    };

    state = async (req: Request, res: Response) => {
        const states = await this.repos.userStates.findAllForUser(req.userId!);
        res.json({ states });
    };

    private toResponseBody(outcome: Awaited<ReturnType<ConversationService["start"]>>) {
        if (outcome.kind === "question") {
            return {
                status: "active",
                moduleId: outcome.moduleId,
                question: outcome.question,
                state: outcome.state,
            };
        }
        return {
            status: this.labelForCompleted(outcome.state),
            state: outcome.state,
        };
    }

    private labelForCompleted(state: UserModuleState): string {
        if (state.status === "expired") return "expired";
        const completedAt = state.completedAt ?? state.lastActivityAt;
        return daysSince(completedAt) <= COMPLETED_RECENT_DAYS ? "completed_recently" : "completed";
    }
}