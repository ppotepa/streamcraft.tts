/**
 * Job domain errors.
 */

import { DomainError, InvalidStateError, NotFoundError } from '../../shared/errors';

export class JobNotFoundError extends NotFoundError {
    constructor(jobId: string) {
        super('Job', jobId);
    }
}

export class StepFailedError extends DomainError {
    readonly code = 'STEP_FAILED';

    constructor(
        readonly stepName: string,
        readonly exitCode: number,
        readonly details: string
    ) {
        super(`Step '${stepName}' failed with code ${exitCode}: ${details}`);
    }
}

export class InvalidJobTransitionError extends InvalidStateError {
    readonly code = 'INVALID_JOB_TRANSITION';

    constructor(currentState: string, attemptedTransition: string) {
        super(currentState, `transition to ${attemptedTransition}`);
    }
}
