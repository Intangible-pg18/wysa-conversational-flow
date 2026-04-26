import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type {Module, ModuleId, QuestionId} from "../../domain/entities.js";
import type { ModuleRepository } from "../../application/repository-contracts/module-repository.js";
import { logger } from "../../config/logger.js";
import { moduleSchema, type ModuleJson } from "./module-schema.js";

function validateReferences(parsed: ModuleJson): void {
  const questionIds = new Set(Object.keys(parsed.questions));

  if (!questionIds.has(parsed.entryQuestionId)) {
    throw new Error(`Module '${parsed.id}': entryQuestionId '${parsed.entryQuestionId}' is not a known question.`);
  }

  for (const [qid, question] of Object.entries(parsed.questions)) {
    if (question.id !== qid) {
      throw new Error(`Module '${parsed.id}': question key '${qid}' does not match its id '${question.id}'.`);
    }
    for (const option of question.options) {
      if (option.target.kind === "next") {
        if (!questionIds.has(option.target.nextQuestionId)) {
          throw new Error(`Module '${parsed.id}', question '${qid}', option '${option.id}': nextQuestionId '${option.target.nextQuestionId}' is not a known question.`);
        }
      }
    }
  }
}

function toDomain(parsed: ModuleJson): Module {
  return {
    id: parsed.id as ModuleId,
    name: parsed.name,
    version: parsed.version,
    entryQuestionId: parsed.entryQuestionId as QuestionId,
    questions: parsed.questions as Module["questions"],
  };
}

export async function seedModules(modulesDir: string, repository: ModuleRepository): Promise<number> {
  const files = (await readdir(modulesDir)).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    logger.warn({ modulesDir }, "No module files found to seed");
    return 0;
  }

  let count = 0;
  for (const file of files) {
    const path = join(modulesDir, file);
    const raw = await readFile(path, "utf8");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } 
    catch (err) {
      throw new Error(`Module '${file}': invalid JSON — ${(err as Error).message}`);
    }

    const parsed = moduleSchema.parse(json);
    validateReferences(parsed);
    await repository.upsert(toDomain(parsed));
    count++;
    logger.info({ moduleId: parsed.id, version: parsed.version, file }, "Seeded module");
  }
  return count;
}