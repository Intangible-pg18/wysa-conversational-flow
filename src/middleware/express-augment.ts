import type {UserId} from "../domain/entities.js";

declare global {
    namespace Express {
        interface Request {
            userId?: UserId;
        }
    }
}

export {}