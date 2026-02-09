/**
 * Create job use case handler.
 */

import { JobRepository } from '../../../domain/job/ports/job-repository';
import { Job } from '../../../domain/job/entities/job.entity';
import { createJobId, createVodId } from '../../../domain/shared/branded-types';
import { Err, Ok, Result } from '../../../domain/shared/result';
import { ValidationError } from '../../../domain/shared/errors';
import { VodUrl } from '../../../domain/vod/value-objects/vod-url';
import { UseCase } from '../../shared/use-case';
import { CreateJobCommand } from './create-job.command';
import { CreateJobDto } from './create-job.dto';

export class CreateJobHandler extends UseCase<
    CreateJobCommand,
    CreateJobDto,
    ValidationError | Error
> {
    constructor(private readonly jobRepository: JobRepository) {
        super();
    }

    async execute(
        request: CreateJobCommand
    ): Promise<Result<CreateJobDto, ValidationError | Error>> {
        try {
            // Validate VOD URL
            const vodUrl = VodUrl.fromString(request.vodUrl);

            // Extract VOD ID
            const vodIdStr = vodUrl.extractId();
            const vodId = createVodId(vodIdStr);

            // Create job ID
            const jobId = createJobId(crypto.randomUUID());

            // Create job entity
            const job = Job.create(jobId, vodId, request.vodUrl);

            // Save job
            const saveResult = await this.jobRepository.save(job);
            if (!saveResult.ok) {
                return Err(saveResult.error);
            }

            const savedJob = saveResult.value;

            // Map to DTO
            const dto: CreateJobDto = {
                jobId: savedJob.id,
                vodId: savedJob.vodId,
                vodUrl: savedJob.vodUrl,
                status: savedJob.status.kind,
                createdAt: savedJob.createdAt.toIso(),
            };

            return Ok(dto);
        } catch (error) {
            if (error instanceof ValidationError) {
                return Err(error);
            }
            return Err(
                error instanceof Error ? error : new Error(String(error))
            );
        }
    }
}
