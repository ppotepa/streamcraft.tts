/**
 * List jobs use case - DTO
 */

import { JobStatusKind } from '../../../domain/job/value-objects/job-status';

export interface JobSummaryDto {
    readonly jobId: string;
    readonly vodUrl: string;
    readonly statusKind: JobStatusKind;
    readonly createdAt: string;
}

export interface ListJobsDto {
    readonly jobs: readonly JobSummaryDto[];
    readonly totalCount: number;
}
