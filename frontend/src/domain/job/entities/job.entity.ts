/**
 * Job entity - aggregate root for job management.
 */

import { JobId, VodId } from '../../shared/branded-types';
import { Err, Ok, Result } from '../../shared/result';
import { Timestamp } from '../../shared/value-objects';
import { InvalidJobTransitionError } from '../errors/job-errors';
import {
    createDone,
    createError,
    createIdle,
    createRunning,
    DoneStatus,
    ErrorStatus,
    isDone,
    isError,
    JobStatus,
} from '../value-objects/job-status';
import { StepName } from '../value-objects/step-name';

export interface JobStep {
    readonly name: StepName;
    readonly status: JobStatus;
    readonly startedAt: Timestamp | null;
    readonly completedAt: Timestamp | null;
    readonly logMessages: ReadonlyArray<string>;
}

export class Job {
    private constructor(
        readonly id: JobId,
        readonly vodId: VodId,
        readonly vodUrl: string,
        readonly status: JobStatus,
        readonly steps: ReadonlyArray<JobStep>,
        readonly createdAt: Timestamp,
        readonly updatedAt: Timestamp
    ) { }

    static create(id: JobId, vodId: VodId, vodUrl: string): Job {
        const now = Timestamp.now();
        const steps = Object.values(StepName).map(
            (stepName): JobStep => ({
                name: stepName,
                status: createIdle(),
                startedAt: null,
                completedAt: null,
                logMessages: [],
            })
        );

        return new Job(id, vodId, vodUrl, createIdle(), steps, now, now);
    }

    startStep(stepName: StepName): Result<Job, InvalidJobTransitionError> {
        if (isError(this.status)) {
            return Err(
                new InvalidJobTransitionError('error', `start ${stepName}`)
            );
        }

        const updatedSteps = this.steps.map((step) =>
            step.name === stepName
                ? {
                    ...step,
                    status: createRunning(stepName, 0.0),
                    startedAt: Timestamp.now(),
                }
                : step
        );

        return Ok(
            new Job(
                this.id,
                this.vodId,
                this.vodUrl,
                createRunning(stepName, 0.0),
                updatedSteps,
                this.createdAt,
                Timestamp.now()
            )
        );
    }

    completeStep(
        stepName: StepName,
        exitCode: number
    ): Result<Job, InvalidJobTransitionError> {
        if (!this.status || this.status.kind !== 'running') {
            return Err(
                new InvalidJobTransitionError(
                    String(this.status.kind),
                    'complete step'
                )
            );
        }

        const updatedSteps = this.steps.map((step) =>
            step.name === stepName
                ? {
                    ...step,
                    status: createDone(exitCode),
                    completedAt: Timestamp.now(),
                }
                : step
        );

        const allDone = updatedSteps.every((s) => isDone(s.status));
        const newStatus = allDone ? createDone(0) : this.status;

        return Ok(
            new Job(
                this.id,
                this.vodId,
                this.vodUrl,
                newStatus,
                updatedSteps,
                this.createdAt,
                Timestamp.now()
            )
        );
    }

    fail(message: string, exitCode: number): Job {
        return new Job(
            this.id,
            this.vodId,
            this.vodUrl,
            createError(message, exitCode),
            this.steps,
            this.createdAt,
            Timestamp.now()
        );
    }
}
