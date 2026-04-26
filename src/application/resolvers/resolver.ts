import type {NextStep, Option, PathEntry, Question} from "../../domain/entities.js"

export interface ResolverInput {
    question: Question,
    selectedOption: Option,
    path: PathEntry[]
}

export interface NextQuestionResolver {
    resolve(input: ResolverInput): NextStep
}