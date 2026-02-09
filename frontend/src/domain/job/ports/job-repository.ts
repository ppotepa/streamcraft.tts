/**
 * Job repository port - defines contract for job persistence.
 */

import { JobId } from '../../shared/branded-types';
import { Result } from '../../shared/result';
import { Job } from '../entities/job.entity';
import { JobNotFoundError } from '../errors/job-errors';

export interface JobRepository {
    save(job: Job): Promise<Result<Job, Error>>;

    findById(jobId: JobId): Promise<Result<Job, JobNotFoundError>>;

    findAll(): Promise<Result<ReadonlyArray<Job>, Error>>;

    delete(jobId: JobId): Promise<Result<void, JobNotFoundError>>;
}
