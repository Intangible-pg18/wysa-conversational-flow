import { randomUUID } from "node:crypto";
import type {HistoryEntry, Module, ModuleId, OptionId, Question, QuestionId, UserId, UserModuleState} from "../../domain/entities.js";
import {ABANDONED_EXPIRY_DAYS, daysToMs} from "../../domain/constants.js";
import {InvalidOptionError, NotFoundError, StateConflictError} from "../../domain/errors.js";
import type { ModuleRepository } from "../repository-contracts/module-repository.js";
import type { UserStateRepository } from "../repository-contracts/user-state-repository.js";
import type { HistoryRepository } from "../repository-contracts/history-repository.js";
import { getResolver } from "../resolvers/registry.js";
import { logger } from "../../config/logger.js";

export type ConversationOutcome = 
    {
        kind: "question",
        moduleId: ModuleId,
        question: Question,
        state: UserModuleState
    }
    | {
        kind: "completed",
        state: UserModuleState
    };

export class ConversationalService {
    constructor(private readonly modules: ModuleRepository, private readonly userStates: UserStateRepository, private readonly history: HistoryRepository) {}

    async start(userId: UserId, moduleId: ModuleId): Promise<ConversationOutcome> {
        const module = await this.requireModule(moduleId);
        const state = await this.loadActiveOrExpire(userId, moduleId);

        if (!state || state.status === "expired")
            return this.startFresh(userId, module);

        if (state.status === "completed")
            return { kind: "completed", state };

        const question = this.requireQuestion(module, state.currentQuestionId!);
        return { kind: "question", moduleId: module.id, question, state };
    }

    async getCurrent(userId: UserId, moduleId: ModuleId): Promise<ConversationOutcome> {
        const module = await this.requireModule(moduleId);
        const state = await this.loadActiveOrExpire(userId, moduleId);
        if (!state) throw new NotFoundError("State for user/module not found.");

        if (state.status !== "active")
            return { kind: "completed", state };

        const question = this.requireQuestion(module, state.currentQuestionId!);
        return { kind: "question", moduleId: module.id, question, state };
    }

    async answer(userId: UserId, moduleId: ModuleId, questionId: QuestionId, optionId: OptionId): Promise<ConversationOutcome> {
        const module = await this.requireModule(moduleId);
        const state = await this.userStates.findByUserAndModule(userId, moduleId);
        if (!state) throw new NotFoundError("State for user/module not found.");
        
        if(state.status !== "active" || this.isExpired(state))
            throw new StateConflictError("Cannot answer: session if not active. Restart the mdodule.");

        if(state.currentQuestionId !== questionId) 
            throw new StateConflictError(`Question "${questionId}" is not the current question.`)

        const question = this.requireQuestion(module, questionId);
        const option = question.options.find((o) => o.id === optionId);
        if(!option) 
            throw new InvalidOptionError(`Option '${optionId}' is not valid for question '${questionId}'.`);
        
        const historyEntry: HistoryEntry = {
            id: randomUUID(),
            userId,
            moduleId,
            questionId,
            optionId,
            questionText: question.text,
            optionLabel: option.label,
            timestamp: new Date(),
            supersededBy: null,
        };
        await this.history.append(historyEntry);

        const next = getResolver(question.resolverType).resolve({
            question,
            selectedOption: option,
            path: state.path
        });

        const now = new Date();
        const isCheckpoint = question.isCheckpoint;
        const newPathEntry = { questionId, optionId };
        const newPath = isCheckpoint ? [newPathEntry] : [...state.path, newPathEntry];
        const newCheckpointId = isCheckpoint ? questionId : state.lastCheckpointId;

        let updatedState: UserModuleState;

        if (next.kind === "end" || next.kind === "switchModule") {
            updatedState = {
                ...state,
                currentQuestionId: null,
                path: newPath,
                lastCheckpointId: newCheckpointId,
                status: "completed",
                lastActivityAt: now,
                completedAt: now,
            };
        } 
        else {
            updatedState = {
                ...state,
                currentQuestionId: next.questionId,
                path: newPath,
                lastCheckpointId: newCheckpointId,
                lastActivityAt: now,
            };
        }

        await this.userStates.save(updatedState);

        if (next.kind === "end")
            return { kind: "completed", state: updatedState };

        if (next.kind === "switchModule") 
            return this.start(userId, next.moduleId);

        const nextQuestion = this.requireQuestion(module, next.questionId);
        return {
            kind: "question",
            moduleId: module.id,
            question: nextQuestion,
            state: updatedState,
        };
    }

    async back(userId: UserId, moduleId: ModuleId): Promise<ConversationOutcome> {
        const module = await this.requireModule(moduleId);
        const state = await this.userStates.findByUserAndModule(userId, moduleId);
        if (!state) throw new NotFoundError("State for user/module not found.");
        
        if(state.status !== "active")
            throw new StateConflictError("Cannot go back: session is not active.");
        if (state.path.length === 0) 
            throw new StateConflictError("Already at the start of this module.");
        
        const lastEntry = state.path[state.path.length - 1]!;
        if(lastEntry.questionId === state.lastCheckpointId)
            throw new StateConflictError("Cannot navigate back past a checkpoint.");

        const newPath = state.path.slice(0, -1);
        const updated: UserModuleState = {
            ...state,
            currentQuestionId: lastEntry.questionId,
            path: newPath,
            lastActivityAt: new Date()
        }
        await this.userStates.save(updated);

        const question = this.requireQuestion(module, lastEntry.questionId);
        return {
            kind: "question",
            moduleId: module.id,
            question,
            state: updated
        };
    }

    async resolveDeepLink(userId: UserId, moduleId: ModuleId, requestedQuestionId: QuestionId): Promise<ConversationOutcome> {
        const module = await this.requireModule(moduleId);
        const state = await this.loadActiveOrExpire(userId, moduleId);

        const linkedQuestionExists = !!module.questions[requestedQuestionId];
        if(!linkedQuestionExists)
            logger.debug({userId, moduleId, requestedQuestionId}, "Deep link points to non-existent question");
        
        if (!state || state.status === "expired")
            return this.startFresh(userId, module);

        if (state.status === "completed")
            return { kind: "completed", state };

        const linkAlignsWithCurrent = linkedQuestionExists && state.currentQuestionId === requestedQuestionId;
        if (!linkAlignsWithCurrent) {
            logger.debug(
                {
                    userId,
                    moduleId,
                    requestedQuestionId,
                    actualCurrentQuestionId: state.currentQuestionId,
                },
                "Deep link overridden by current state"
            );
        }

        const question = this.requireQuestion(module, state.currentQuestionId!);
        return { kind: "question", moduleId: module.id, question, state };
    }

    private async startFresh(userId: UserId, module: Module): Promise<ConversationOutcome> {
        const now = new Date();
        const state: UserModuleState = {
            userId,
            moduleId: module.id,
            currentQuestionId: module.entryQuestionId,
            path: [],
            lastCheckpointId: null,
            status: "active",
            startedAt: now,
            lastActivityAt: now,
            completedAt: null
        };
        await this.userStates.save(state);
        const question = this.requireQuestion(module, module.entryQuestionId);
        return {kind: "question", moduleId: module.id, question, state};
    }

    private async requireModule(moduleId: ModuleId): Promise<Module> {
        const module = await this.modules.findById(moduleId);
        if(!module) throw new NotFoundError(`Module "${moduleId}" not found.`);
        return module;
    }

    private requireQuestion(module: Module, questionId: QuestionId): Question {
        const question = module.questions[questionId];
        if (!question)
            throw new Error(`Module '${module.id}' has no question '${questionId}'.`);
        return question;
    }

    private async loadActiveOrExpire(userId: UserId, moduleId: ModuleId): Promise<UserModuleState | null> {
        const state = await this.userStates.findByUserAndModule(userId, moduleId);
        if(!state) return null;

        if(state.status === "active" && this.isExpired(state)) {
            const expired: UserModuleState = {
                ...state,
                status: "expired",
                currentQuestionId: null,
                lastActivityAt: new Date(),
            };
            await this.userStates.save(expired);
            return expired;
        }
        return state;
    }

    private isExpired(state: UserModuleState): boolean {
        if (state.status !== "active") return false;
        const ageMs = Date.now() - state.lastActivityAt.getTime();
        return ageMs > daysToMs(ABANDONED_EXPIRY_DAYS);
    }
}