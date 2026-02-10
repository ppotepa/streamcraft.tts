/**
 * React hook for GetJobStatus use case
 */

import { useState, useCallback } from 'react';
import type { Result } from '../../../domain/shared/result';
import { JobNotFoundError } from '../../../domain/job/errors/job-errors';
import { GetJobStatusHandler, GetJobStatusCommand, GetJobStatusDto } from '../../../application/job/get-job-status';
import { JobId } from '../../../domain/job/value-objects/job-id';

export interface UseGetJobStatusResult {
    data: GetJobStatusDto | null;
    isLoading: boolean;
    error: JobNotFoundError | null;
    execute: (jobId: JobId) => Promise<void>;
    reset: () => void;
}

export function useGetJobStatus(
    handler: GetJobStatusHandler
): UseGetJobStatusResult {
    const [data, setData] = useState<GetJobStatusDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<JobNotFoundError | null>(null);

    const execute = useCallback(
        async (jobId: JobId) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: GetJobStatusCommand = { jobId };
                const result = await handler.execute(command);

                if (result.isSuccess()) {
                    setData(result.value);
                } else {
                    setError(result.error);
                }
            } catch (err) {
                setError(err as JobNotFoundError);
            } finally {
                setIsLoading(false);
            }
        },
        [handler]
    );

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return { data, isLoading, error, execute, reset };
}
