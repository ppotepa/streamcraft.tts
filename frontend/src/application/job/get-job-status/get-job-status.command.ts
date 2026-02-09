/**
 * Get job status use case - Command
 */

import { JobId } from '../../../domain/job/value-objects/job-id';

export interface GetJobStatusCommand {
    readonly jobId: JobId;
}
