/**
 * Complete job step use case - Handler
 */

import { Result } from '../../../domain/shared/result';
import { JobNotFoundError } from '../../../domain/job/errors/job-errors';
import { JobRepository } from '../../../domain/job/ports/job-repository';
import { CompleteJobStepCommand } from './complete-job-step.command';
import { CompleteJobStepDto } from './complete-job-step.dto';

export class CompleteJobStepHandler {
    constructor(private readonly jobRepository: JobRepository) { }

    async execute(
        command: CompleteJobStepCommand
    ): Promise<Result<CompleteJobStepDto, JobNotFoundError>> {
        // Find job
        const jobResult = await this.jobRepository.findById(command.jobId);
        if (jobResult.isFailure()) {
            return jobResult as Result<never, JobNotFoundError>;
        }

        const job = jobResult.value;

        // Complete the step (domain logic handles state transition)
        job.completeStep(command.stepName);

        // Save updated job
        const saveResult = await this.jobRepository.save(job);
        if (saveResult.isFailure()) {
            return Result.fail(saveResult.error as JobNotFoundError);
        }

        // Get updated status
        const status = job.getStatus();

        // Determine next step
        const nextStep = status.kind === 'running' ? status.currentStep : null;

        // Create DTO
        const dto: CompleteJobStepDto = {
            jobId: job.getId(),
            completedStep: command.stepName,
            statusKind: status.kind,
            nextStep,
        };

        return Result.ok(dto);
    }
}
