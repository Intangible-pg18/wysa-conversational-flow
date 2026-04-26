import { z } from "zod";

const idString = z.string().min(1);

const optionTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("next"),
    nextQuestionId: idString,
  }),
  z.object({
    kind: z.literal("switch"),
    targetModuleId: idString,
    targetQuestionId: idString.optional(),
  }),
  z.object({
    kind: z.literal("terminal"),
  }),
]);

const optionSchema = z.object({
  id: idString,
  label: z.string().min(1),
  target: optionTargetSchema,
});

const questionSchema = z.object({
  id: idString,
  text: z.string().min(1),
  isCheckpoint: z.boolean(),
  resolverType: z.literal("simple"),
  options: z.array(optionSchema).min(1),
});

export const moduleSchema = z.object({
  id: idString,
  name: z.string().min(1),
  version: z.number().int().positive(),
  entryQuestionId: idString,
  questions: z.record(idString, questionSchema),
});

export type ModuleJson = z.infer<typeof moduleSchema>;