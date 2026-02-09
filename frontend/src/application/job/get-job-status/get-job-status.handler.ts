/**
 * Get job status use case - Handler
 */

import { Result } from '../../../domain/shared/result';
import { JobNotFoundError } from '../../../domain/job/errors/job-errors';
import { JobRepository } from '../../../domain/job/ports/job-repository';
import { GetJobStatusCommand } from './get-job-status.command';
import { GetJobStatusDto } from './get-job-status.dto';

export class GetJobStatusHandler {
    constructor(private readonly jobRepository: JobRepository) { }

    async execute(
        command: GetJobStatusCommand
    ): Promise<Result<GetJobStatusDto, JobNotFoundError>> {
        // Find job
        const jobResult = await this.jobRepository.findById(command.jobId);
        if (jobResult.isFailure()) {
            return jobResult as Result<never, JobNotFoundError>;
        }

        const job = jobResult.value;
        const status = job.getStatus();

        // Create DTO
        const dto: GetJobStatusDto = {
            jobId: job.getId(),
            vodUrl: job.getVodUrl(),
            statusKind: status.kind,
            currentStep: status.kind === 'running' ? status.currentStep : null,
            progress: status.kind === 'running' ? status.progress : null,
            errorMessage: status.kind === 'error' ? status.errorMessage : null,
            createdAt: job.getCreatedAt().toISOString(),
            updatedAt: job.getUpdatedAt().toISOString(),
        };

        return Result.ok(dto);
    }
}
