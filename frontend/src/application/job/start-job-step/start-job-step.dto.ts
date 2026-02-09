/**
 * Start job step use case - DTO
 */

import { JobStatusKind } from '../../../domain/job/value-objects/job-status';
import { StepName } from '../../../domain/job/value-objects/step-name';

export interface StartJobStepDto {
    readonly jobId: string;
    readonly currentStep: StepName;
    readonly statusKind: JobStatusKind;
}
