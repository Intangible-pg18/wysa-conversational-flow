import type {Request, Response, NextFunction} from "express"
import {ValidationError} from "../domain/errors.js"
import {asUserId} from "../domain/entities.js"
import "./express-augment.js"

const HEADER = "x-user-id";

export function userContext(req: Request, _res: Response, next: NextFunction) {
    const raw = req.header(HEADER);
    if(!raw || raw.trim().length === 0)
        throw new ValidationError(`Missing or empty header: ${HEADER}`);

    req.userId = asUserId(raw.trim());
    next();
}