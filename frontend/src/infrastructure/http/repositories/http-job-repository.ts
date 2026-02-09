/**
 * HTTP Job Repository Adapter
 */

import { Result } from '../../../domain/shared/result';
import { Job } from '../../../domain/job/entities/job.entity';
import { JobId } from '../../../domain/job/value-objects/job-id';
import { JobRepository } from '../../../domain/job/ports/job-repository';
import { JobNotFoundError } from '../../../domain/job/errors/job-errors';
import { HttpClient } from '../client/http-client';

interface JobDto {
    jobId: string;
    vodUrl: string;
    status: {
        kind: 'idle' | 'running' | 'done' | 'error';
        currentStep?: string;
        progress?: number;
        errorMessage?: string;
    };
    createdAt: string;
    updatedAt: string;
}

export class HttpJobRepository implements JobRepository {
    constructor(private readonly httpClient: HttpClient) { }

    async findById(id: JobId): Promise<Result<Job, JobNotFoundError>> {
        try {
            const response = await this.httpClient.get<JobDto>(`/jobs/${id}`);

            if (response.isFailure()) {
                return Result.fail(
                    new JobNotFoundError(`Job ${id} not found`)
                );
            }

            const dto = response.value;
            const job = this.mapDtoToEntity(dto);

            return Result.ok(job);
        } catch (error) {
            return Result.fail(
                new JobNotFoundError(`Failed to fetch job ${id}: ${error}`)
            );
        }
    }

    async findAll(): Promise<Result<readonly Job[], Error>> {
        try {
            const response = await this.httpClient.get<{
                jobs: JobDto[];
                totalCount: number;
            }>('/jobs');

            if (response.isFailure()) {
                return Result.fail(new Error('Failed to fetch jobs'));
            }

            const jobs = response.value.jobs.map((dto) => this.mapDtoToEntity(dto));

            return Result.ok(jobs);
        } catch (error) {
            return Result.fail(new Error(`Failed to fetch jobs: ${error}`));
        }
    }

    async save(job: Job): Promise<Result<void, Error>> {
        try {
            const dto = this.mapEntityToDto(job);
            const response = await this.httpClient.post<void>('/jobs', dto);

            if (response.isFailure()) {
                return Result.fail(new Error('Failed to save job'));
            }

            return Result.ok(undefined);
        } catch (error) {
            return Result.fail(new Error(`Failed to save job: ${error}`));
        }
    }

    async delete(id: JobId): Promise<Result<void, Error>> {
        try {
            const response = await this.httpClient.delete<void>(`/jobs/${id}`);

            if (response.isFailure()) {
                return Result.fail(new Error('Failed to delete job'));
            }

            return Result.ok(undefined);
        } catch (error) {
            return Result.fail(new Error(`Failed to delete job: ${error}`));
        }
    }

    private mapDtoToEntity(dto: JobDto): Job {
        return new Job(
            dto.jobId,
            dto.vodUrl,
            dto.status,
            new Date(dto.createdAt),
            new Date(dto.updatedAt)
        );
    }

    private mapEntityToDto(job: Job): JobDto {
        return {
            jobId: job.getId(),
            vodUrl: job.getVodUrl(),
            status: job.getStatus(),
            createdAt: job.getCreatedAt().toISOString(),
            updatedAt: job.getUpdatedAt().toISOString(),
        };
    }
}
