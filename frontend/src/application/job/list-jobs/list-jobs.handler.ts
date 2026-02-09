/**
 * List jobs use case - Handler
 */

import { Result } from '../../../domain/shared/result';
import { JobRepository } from '../../../domain/job/ports/job-repository';
import { ListJobsCommand } from './list-jobs.command';
import { ListJobsDto, JobSummaryDto } from './list-jobs.dto';

export class ListJobsHandler {
    constructor(private readonly jobRepository: JobRepository) { }

    async execute(command: ListJobsCommand): Promise<Result<ListJobsDto, Error>> {
        // Find all jobs
        const jobsResult = await this.jobRepository.findAll();
        if (jobsResult.isFailure()) {
            return Result.fail(jobsResult.error);
        }

        const allJobs = jobsResult.value;

        // Apply pagination
        const start = command.offset;
        const end = command.limit ? start + command.limit : allJobs.length;
        const paginatedJobs = allJobs.slice(start, end);

        // Convert to DTOs
        const jobSummaries: JobSummaryDto[] = paginatedJobs.map((job) => ({
            jobId: job.getId(),
            vodUrl: job.getVodUrl(),
            statusKind: job.getStatus().kind,
            createdAt: job.getCreatedAt().toISOString(),
        }));

        const dto: ListJobsDto = {
            jobs: jobSummaries,
            totalCount: allJobs.length,
        };

        return Result.ok(dto);
    }
}
