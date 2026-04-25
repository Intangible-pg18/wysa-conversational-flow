export abstract class DomainError extends Error {
    abstract readonly code: string;
    abstract readonly httpStatus: number;

    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
    }
}

export class ValidationError extends DomainError {
    readonly code = "VALIDATION_ERROR";
    readonly httpStatus = 400;
}

export class InvalidOptionError extends DomainError {
    readonly code = "INVALID_OPTION";
    readonly httpStatus = 400;
}

export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";
  readonly httpStatus = 404;
}

export class StateConflictError extends DomainError {
  readonly code = "STATE_CONFLICT";
  readonly httpStatus = 409;
}

export class SessionExpiredError extends DomainError {
  readonly code = "SESSION_EXPIRED";
  readonly httpStatus = 410;
}
