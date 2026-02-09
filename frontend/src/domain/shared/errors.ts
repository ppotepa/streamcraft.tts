/**
 * Base domain error classes.
 *
 * All domain errors extend DomainError to maintain type hierarchy.
 * Each error is explicit and carries meaningful information.
 */

export abstract class DomainError extends Error {
    abstract readonly code: string;

    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, new.target.prototype);
    }

    toString(): string {
        return `[${this.code}] ${this.message}`;
    }
}

export class ValidationError extends DomainError {
    readonly code = 'VALIDATION_ERROR';

    constructor(
        readonly field: string,
        readonly value: unknown,
        message: string
    ) {
        super(message);
    }
}

export class NotFoundError extends DomainError {
    readonly code = 'NOT_FOUND';

    constructor(
        readonly entityType: string,
        readonly entityId: string
    ) {
        super(`${entityType} with id '${entityId}' not found`);
    }
}

export class InvalidStateError extends DomainError {
    readonly code = 'INVALID_STATE';

    constructor(
        readonly currentState: string,
        readonly attemptedAction: string
    ) {
        super(`Cannot ${attemptedAction} in state ${currentState}`);
    }
}
