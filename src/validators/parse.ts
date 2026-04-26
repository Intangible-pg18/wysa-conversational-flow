import type { z } from "zod";
import { ValidationError } from "../domain/errors.js";

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