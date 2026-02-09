/**
 * Start job step use case - Handler
 */

import { Result } from '../../../domain/shared/result';
import { JobNotFoundError } from '../../../domain/job/errors/job-errors';
import { JobRepository } from '../../../domain/job/ports/job-repository';
import { StartJobStepCommand } from './start-job-step.command';
import { StartJobStepDto } from './start-job-step.dto';

export class StartJobStepHandler {
    constructor(private readonly jobRepository: JobRepository) { }

    async execute(
        command: StartJobStepCommand
    ): Promise<Result<StartJobStepDto, JobNotFoundError>> {
        // Find job
        const jobResult = await this.jobRepository.findById(command.jobId);
        if (jobResult.isFailure()) {
            return jobResult as Result<never, JobNotFoundError>;
        }

        const job = jobResult.value;

        // Start the step (domain logic handles state transition)
        job.startStep(command.stepName);

        // Save updated job
        const saveResult = await this.jobRepository.save(job);
        if (saveResult.isFailure()) {
            return Result.fail(saveResult.error as JobNotFoundError);
        }

        // Get updated status
        const status = job.getStatus();

        // Create DTO
        const dto: StartJobStepDto = {
            jobId: job.getId(),
            currentStep: command.stepName,
            statusKind: status.kind,
        };

        return Result.ok(dto);
    }
}
