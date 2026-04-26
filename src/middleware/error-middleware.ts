import type { Request, Response, NextFunction } from "express";
import { DomainError } from "../domain/errors.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction) {
    const requestId = (req as Request & {id?: string}).id;
    if(err instanceof DomainError) {
        logger.warn({requestId, code: err.code, message: err.message}, "Domain error");
        res.status(err.httpStatus).json({
            error: err.code,
            message: err.message,
            requestId
        });
    }
    if (err instanceof SyntaxError && "body" in err) {
        logger.warn({ requestId, message: err.message }, "malformed request body");
        res.status(400).json({
            error: "VALIDATION_ERROR",
            message: "Request body is not valid JSON.",
            requestId,
        });
        return;
    }
    logger.error({ requestId, err }, "unhandled error");
    res.status(500).json({
        error: "INTERNAL_ERROR",
        message:
        env.NODE_ENV === "development" ? err.message : "Something went wrong.",
        requestId,
    });
}