import type {Collection, Db} from "mongodb";
import type {Module, ModuleId, Question, QuestionId} from "../../domain/entities.js";
import type {ModuleRepository} from "../../application/repository-contracts/module-repository.js"

type ModuleDoc = {
    _id: string,
    name: string,
    version: number,
    entryQuestionId: QuestionId,
    questions: Record<QuestionId, Question>
}

function fromDoc(doc: ModuleDoc): Module {
  const { _id, ...rest } = doc;
  return { id: _id as ModuleId, ...rest };
}

function toDoc(module: Module): ModuleDoc {
  const { id, ...rest } = module;
  return { _id: id, ...rest };
}

export class MongoModuleRepository implements ModuleRepository {
  private readonly collection: Collection<ModuleDoc>;

  constructor(db: Db) {
    this.collection = db.collection<ModuleDoc>("modules");
  }

  async findById(id: ModuleId): Promise<Module | null> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? fromDoc(doc) : null;
  }

  async findAll(): Promise<Module[]> {
    const docs = await this.collection.find().toArray();
    return docs.map(fromDoc);
  }

  async upsert(module: Module): Promise<void> {
    const { _id, ...rest } = toDoc(module);
    await this.collection.updateOne(
      { _id },
      { $set: rest },
      { upsert: true }
    );
  }
}