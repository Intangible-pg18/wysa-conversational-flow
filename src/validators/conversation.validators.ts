import {z} from "zod";

const idString = z.string().min(1);

export const moduleParamsSchema = z.object({
    moduleId: idString
});

export const answerBodySchema = z.object({
    questionId: idString,
    optionId: idString
});

export const deepLinkQuerySchema = z.object({
    moduleId: idString,
    questionId: idString
})

export const historyQuerySchema = z.object({
    moduleId: idString.optional(),
    limit: z.coerce.number().int().positive().max(200).optional(),
    before: z.coerce.date().optional()
})