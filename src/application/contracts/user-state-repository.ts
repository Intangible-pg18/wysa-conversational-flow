import type {ModuleId, UserId, UserModuleState} from "../../domain/entities.js";

export interface UserStateRepository {
  findByUserAndModule(userId: UserId, moduleId: ModuleId): Promise<UserModuleState | null>;
  findAllForUser(userId: UserId): Promise<UserModuleState[]>;
  save(state: UserModuleState): Promise<void>;
}