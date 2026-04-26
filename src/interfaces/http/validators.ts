import {z} from "zod";
import { ValidationError } from "../../domain/errors.js";

const idString = z.string().min(1);

export const userModuleParamsSchema = z.object({
    userId: idString,
    moduleId: idString
});

export const userParamsSchema = z.object({
    userId: idString
})

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

export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new ValidationError(message);
  }
  return result.data;
}