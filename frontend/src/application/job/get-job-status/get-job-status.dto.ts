/**
 * Get job status use case - DTO
 */

import { JobStatusKind } from '../../../domain/job/value-objects/job-status';
import { StepName } from '../../../domain/job/value-objects/step-name';

export interface GetJobStatusDto {
    readonly jobId: string;
    readonly vodUrl: string;
    readonly statusKind: JobStatusKind;
    readonly currentStep: StepName | null;
    readonly progress: number | null;
    readonly errorMessage: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
}
