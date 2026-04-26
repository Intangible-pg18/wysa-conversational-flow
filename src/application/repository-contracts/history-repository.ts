import type {HistoryEntry, ModuleId, UserId} from "../../domain/entities.js";

export interface HistoryListOptions {
  before?: Date;
  limit?: number;
}

export interface HistoryRepository {
  append(entry: HistoryEntry): Promise<void>;

  findByUserAndModule(userId: UserId, moduleId: ModuleId, options?: HistoryListOptions): Promise<HistoryEntry[]>;

  findByUser(userId: UserId, options?: HistoryListOptions): Promise<HistoryEntry[]>;

  markSuperseded(entryIds: string[], supersededByEntryId: string): Promise<void>;
}