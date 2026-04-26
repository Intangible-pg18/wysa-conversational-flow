import type { Db } from "mongodb";
import { MongoModuleRepository } from "./repositories/mongo-module-repository.js";
import { MongoUserStateRepository } from "./repositories/mongo-user-state-repository.js";
import { MongoHistoryRepository } from "./repositories/mongo-history-repository.js";
import type { ModuleRepository } from "../application/repository-contracts/module-repository.js";
import type { UserStateRepository } from "../application/repository-contracts/user-state-repository.js";
import type { HistoryRepository } from "../application/repository-contracts/history-repository.js";

export interface Repositories {
  modules: ModuleRepository;
  userStates: UserStateRepository;
  history: HistoryRepository;
}

export async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    MongoUserStateRepository.ensureIndexes(db),
    MongoHistoryRepository.ensureIndexes(db),
  ]);
}

export function wireRepositories(db: Db): Repositories {
  return {
    modules: new MongoModuleRepository(db),
    userStates: new MongoUserStateRepository(db),
    history: new MongoHistoryRepository(db),
  };
}