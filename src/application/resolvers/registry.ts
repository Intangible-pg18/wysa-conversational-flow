import type { ResolverType } from "../../domain/entities.js";
import type { NextQuestionResolver } from "./resolver.js";
import { SimpleOptionResolver } from "./simple-option-resolver.js";

export const resolverRegistry: Record<ResolverType, NextQuestionResolver> = {
    simple: new SimpleOptionResolver()
}

export function getResolver(type: ResolverType): NextQuestionResolver {
    return resolverRegistry[type];
}