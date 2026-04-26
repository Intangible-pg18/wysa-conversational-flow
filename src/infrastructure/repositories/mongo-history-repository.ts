import type {Collection, Db} from "mongodb";
import type {HistoryEntry, ModuleId, OptionId, QuestionId, UserId} from "../../domain/entities.js";
import type {HistoryListOptions, HistoryRepository} from "../../application/contracts/history-repository.js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type HistoryDoc = {
  _id: string;
  userId: UserId;
  moduleId: ModuleId;
  questionId: QuestionId;
  optionId: OptionId;
  questionText: string;
  optionLabel: string;
  timestamp: Date;
  supersededBy: string | null;
};

function fromDoc(doc: HistoryDoc): HistoryEntry {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

function toDoc(entry: HistoryEntry): HistoryDoc {
  const { id, ...rest } = entry;
  return { _id: id, ...rest };
}

function clampLimit(limit: number | undefined): number {
  if (!limit || limit <= 0) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

export class MongoHistoryRepository implements HistoryRepository {
  private readonly collection: Collection<HistoryDoc>;

  constructor(db: Db) {
    this.collection = db.collection<HistoryDoc>("conversation_history");
  }

  static async ensureIndexes(db: Db): Promise<void> {
    const collection = db.collection<HistoryDoc>("conversation_history");
    await collection.createIndex({ userId: 1, moduleId: 1, timestamp: -1 });
    await collection.createIndex({ userId: 1, timestamp: -1 });
  }

  async append(entry: HistoryEntry): Promise<void> {
    await this.collection.insertOne(toDoc(entry));
  }

  async findByUserAndModule(userId: UserId, moduleId: ModuleId, options?: HistoryListOptions): Promise<HistoryEntry[]> {
    const filter: Record<string, unknown> = { userId, moduleId };
    if (options?.before) {
      filter.timestamp = { $lt: options.before };
    }
    const docs = await this.collection
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(clampLimit(options?.limit))
      .toArray();
    return docs.map(fromDoc);
  }

  async findByUser(userId: UserId, options?: HistoryListOptions): Promise<HistoryEntry[]> {
    const filter: Record<string, unknown> = { userId };
    if (options?.before) {
      filter.timestamp = { $lt: options.before };
    }
    const docs = await this.collection
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(clampLimit(options?.limit))
      .toArray();
    return docs.map(fromDoc);
  }

  async markSuperseded(entryIds: string[], supersededByEntryId: string): Promise<void> {
    if (entryIds.length === 0) return;
    await this.collection.updateMany(
      { _id: { $in: entryIds } },
      { $set: { supersededBy: supersededByEntryId } }
    );
  }
}