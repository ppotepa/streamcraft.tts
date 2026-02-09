/**
 * Job status value object with discriminated union pattern.
 */

export enum JobStatusKind {
    Idle = 'idle',
    Running = 'running',
    Done = 'done',
    Error = 'error',
}

export interface IdleStatus {
    readonly kind: JobStatusKind.Idle;
}

export interface RunningStatus {
    readonly kind: JobStatusKind.Running;
    readonly currentStep: string;
    readonly progress: number; // 0.0 to 1.0
}

export interface DoneStatus {
    readonly kind: JobStatusKind.Done;
    readonly exitCode: number;
}

export interface ErrorStatus {
    readonly kind: JobStatusKind.Error;
    readonly message: string;
    readonly exitCode: number;
}

export type JobStatus = IdleStatus | RunningStatus | DoneStatus | ErrorStatus;

// Constructors
export const createIdle = (): IdleStatus => ({
    kind: JobStatusKind.Idle,
});

export const createRunning = (
    currentStep: string,
    progress: number
): RunningStatus => {
    if (progress < 0 || progress > 1) {
        throw new Error('Progress must be between 0.0 and 1.0');
    }
    return {
        kind: JobStatusKind.Running,
        currentStep,
        progress,
    };
};

export const createDone = (exitCode: number): DoneStatus => ({
    kind: JobStatusKind.Done,
    exitCode,
});

export const createError = (message: string, exitCode: number): ErrorStatus => ({
    kind: JobStatusKind.Error,
    message,
    exitCode,
});

// Type guards
export const isIdle = (status: JobStatus): status is IdleStatus => {
    return status.kind === JobStatusKind.Idle;
};

export const isRunning = (status: JobStatus): status is RunningStatus => {
    return status.kind === JobStatusKind.Running;
};

export const isDone = (status: JobStatus): status is DoneStatus => {
    return status.kind === JobStatusKind.Done;
};

export const isError = (status: JobStatus): status is ErrorStatus => {
    return status.kind === JobStatusKind.Error;
};

// Exhaustive matching
export const matchJobStatus = <T>(
    status: JobStatus,
    matcher: {
        readonly idle: (s: IdleStatus) => T;
        readonly running: (s: RunningStatus) => T;
        readonly done: (s: DoneStatus) => T;
        readonly error: (s: ErrorStatus) => T;
    }
): T => {
    switch (status.kind) {
        case JobStatusKind.Idle:
            return matcher.idle(status);
        case JobStatusKind.Running:
            return matcher.running(status);
        case JobStatusKind.Done:
            return matcher.done(status);
        case JobStatusKind.Error:
            return matcher.error(status);
    }
};
