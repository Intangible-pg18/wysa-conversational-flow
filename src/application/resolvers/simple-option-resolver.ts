import type { NextStep } from "../../domain/entities.js";
import type { NextQuestionResolver, ResolverInput } from "./resolver.js";

export class SimpleOptionResolver implements NextQuestionResolver {
    resolve(input: ResolverInput): NextStep {
        const {target} = input.selectedOption;
        switch (target.kind) {
            case "next":
                return { kind: "question", questionId: target.nextQuestionId };
            case "switch":
                return {
                kind: "switchModule",
                moduleId: target.targetModuleId,
                questionId: target.targetQuestionId,
                };
            case "terminal":
                return { kind: "end" };
        }
    }
}