export type UserId = string & {readonly __brand: "UserId"};
export type ModuleId = string & {readonly __brand: "ModuleId"}
export type QuestionId = string & { readonly __brand: "QuestionId" };
export type OptionId = string & { readonly __brand: "OptionId" };

export const asUserId = (s: string) => s as UserId;
export const asModuleId = (s: string) => s as ModuleId;
export const asQuestionId = (s: string) => s as QuestionId;
export const asOptionId = (s: string) => s as OptionId;

export type OptionTarget = {kind: "next", nextQuestionId: QuestionId} | {kind: "switch", targetModuleId: ModuleId, targetQuestionId?: QuestionId} | {kind: "terminal"}

export interface Option {
    id: OptionId,
    label: string,
    target: OptionTarget
}

export type ResolverType = "simple"

export interface Question {
    id: QuestionId,
    text: string,
    isCheckpoint: boolean,
    resolverType: ResolverType,
    options: Option[]
}

export interface Module {
    id: ModuleId,
    name: string,
    version: number,
    entryQuestionId: QuestionId,
    questions: Record<QuestionId, Question>
}

export interface PathEntry {
    questionId: QuestionId,
    optionId: OptionId
}

export type SessionStatus = "active" | "completed" | "expired";

export interface UserModuleState {
    userId: UserId,
    moduleId: ModuleId,
    currentQuestionId: QuestionId | null,
    path: PathEntry[],
    lastCheckpointId: QuestionId | null,
    status: SessionStatus,
    startedAt: Date,
    lastActivityAt: Date,
    completedAt: Date | null
}

export interface HistoryEntry {
    id: string,
    userId: UserId,
    moduleId: ModuleId,
    questionId: QuestionId,
    optionId: OptionId,
    questionText: string,
    optionLabel: string,
    timestamp: Date,
    supersededBy: string | null
}

export type NextStep = {kind: "question", question: Question} | {kind: "switchModule", moduleId: ModuleId, questionId?: QuestionId} | {kind: "end"}