/**
 * Complete job step use case - DTO
 */

import { JobStatusKind } from '../../../domain/job/value-objects/job-status';
import { StepName } from '../../../domain/job/value-objects/step-name';

export interface CompleteJobStepDto {
    readonly jobId: string;
    readonly completedStep: StepName;
    readonly statusKind: JobStatusKind;
    readonly nextStep: StepName | null;
}
