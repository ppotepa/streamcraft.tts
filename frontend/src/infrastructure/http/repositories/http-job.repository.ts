/**
 * HTTP-based job repository implementation.
 */

import { Job } from '../../../domain/job/entities/job.entity';
import { JobNotFoundError } from '../../../domain/job/errors/job-errors';
import { JobRepository } from '../../../domain/job/ports/job-repository';
import { createJobId, createVodId, JobId } from '../../../domain/shared/branded-types';
import { Err, Ok, Result } from '../../../domain/shared/result';
import { Timestamp } from '../../../domain/shared/value-objects';
import { HttpClient } from '../client/http-client';
import { JobStatus, createIdle, createRunning, createDone, createError } from '../../../domain/job/value-objects/job-status';
import { StepName } from '../../../domain/job/value-objects/step-name';

interface JobDto {
    readonly job_id: string;
    readonly vod_id: string;
    readonly vod_url: string;
    readonly status: string;
    readonly created_at: string;
    readonly updated_at: string;
}

export class HttpJobRepository implements JobRepository {
    constructor(private readonly httpClient: HttpClient) { }

    async save(job: Job): Promise<Result<Job, Error>> {
        const result = await this.httpClient.post<JobDto>('/jobs/', {
            vod_url: job.vodUrl,
        });

        if (!result.ok) {
            return Err(new Error(result.error.message));
        }

        return Ok(job);
    }

    async findById(jobId: JobId): Promise<Result<Job, JobNotFoundError>> {
        const result = await this.httpClient.get<JobDto>(`/jobs/${jobId}`);

        if (!result.ok) {
            return Err(new JobNotFoundError(jobId));
        }

        const dto = result.value.data;
        return Ok(this.mapDtoToJob(dto));
    }

    async findAll(): Promise<Result<ReadonlyArray<Job>, Error>> {
        const result = await this.httpClient.get<JobDto[]>('/jobs');

        if (!result.ok) {
            return Err(new Error(result.error.message));
        }

        const jobs = result.value.data.map((dto) => this.mapDtoToJob(dto));
        return Ok(jobs);
    }

    async delete(jobId: JobId): Promise<Result<void, JobNotFoundError>> {
        const result = await this.httpClient.delete(`/jobs/${jobId}`);

        if (!result.ok) {
            return Err(new JobNotFoundError(jobId));
        }

        return Ok(undefined);
    }

    private mapDtoToJob(dto: JobDto): Job {
        return Job.create(
            createJobId(dto.job_id),
            createVodId(dto.vod_id),
            dto.vod_url
        );
    }
}
