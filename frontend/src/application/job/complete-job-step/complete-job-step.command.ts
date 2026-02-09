/**
 * Complete job step use case - Command
 */

import { JobId } from '../../../domain/job/value-objects/job-id';
import { StepName } from '../../../domain/job/value-objects/step-name';

export interface CompleteJobStepCommand {
    readonly jobId: JobId;
    readonly stepName: StepName;
}
