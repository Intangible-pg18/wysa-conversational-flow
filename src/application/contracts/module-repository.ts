import type {Module, ModuleId} from "../../domain/entities.js";

export interface ModuleRepository {
    findById(id: ModuleId): Promise<Module | null>;
    findAll(): Promise<Module[]>;
    upsert(module: Module): Promise<void>;
}

