import type { Collection, Db } from "mongodb";
import type {ModuleId, PathEntry, QuestionId, SessionStatus, UserId, UserModuleState,} from "../../domain/entities.js";
import type { UserStateRepository } from "../../application/contracts/user-state-repository.js";

type StateDoc = {
  _id: { userId: UserId; moduleId: ModuleId };
  currentQuestionId: QuestionId | null;
  path: PathEntry[];
  lastCheckpointId: QuestionId | null;
  status: SessionStatus;
  startedAt: Date;
  lastActivityAt: Date;
  completedAt: Date | null;
};

function fromDoc(doc: StateDoc): UserModuleState {
  return {
    userId: doc._id.userId,
    moduleId: doc._id.moduleId,
    currentQuestionId: doc.currentQuestionId,
    path: doc.path,
    lastCheckpointId: doc.lastCheckpointId,
    status: doc.status,
    startedAt: doc.startedAt,
    lastActivityAt: doc.lastActivityAt,
    completedAt: doc.completedAt,
  };
}

function toDoc(state: UserModuleState): StateDoc {
  return {
    _id: { userId: state.userId, moduleId: state.moduleId },
    currentQuestionId: state.currentQuestionId,
    path: state.path,
    lastCheckpointId: state.lastCheckpointId,
    status: state.status,
    startedAt: state.startedAt,
    lastActivityAt: state.lastActivityAt,
    completedAt: state.completedAt,
  };
}

export class MongoUserStateRepository implements UserStateRepository {
  private readonly collection: Collection<StateDoc>;

  constructor(db: Db) {
    this.collection = db.collection<StateDoc>("user_module_states");
  }

  static async ensureIndexes(db: Db): Promise<void> {
    const collection = db.collection<StateDoc>("user_module_states");
    await collection.createIndex({ "_id.userId": 1, status: 1 });
  }

  async findByUserAndModule(userId: UserId, moduleId: ModuleId): Promise<UserModuleState | null> {
    const doc = await this.collection.findOne({_id: { userId, moduleId }});
    return doc ? fromDoc(doc) : null;
  }

  async findAllForUser(userId: UserId): Promise<UserModuleState[]> {
    const docs = await this.collection
      .find({ "_id.userId": userId })
      .toArray();
    return docs.map(fromDoc);
  }

  async save(state: UserModuleState): Promise<void> {
    const doc = toDoc(state);
    const { _id, ...rest } = doc;
    await this.collection.updateOne({ _id }, { $set: rest }, { upsert: true });
  }
}