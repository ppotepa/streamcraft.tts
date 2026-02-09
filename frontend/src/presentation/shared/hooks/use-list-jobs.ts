/**
 * React hook for ListJobs use case
 */

import { useState, useCallback, useEffect } from 'react';
import { ListJobsHandler, ListJobsCommand, ListJobsDto } from '../../../application/job/list-jobs';

export interface UseListJobsOptions {
    limit?: number;
    offset?: number;
    autoFetch?: boolean;
}

export interface UseListJobsResult {
    data: ListJobsDto | null;
    isLoading: boolean;
    error: Error | null;
    execute: (options?: { limit?: number; offset?: number }) => Promise<void>;
    reset: () => void;
}

export function useListJobs(
    handler: ListJobsHandler,
    options: UseListJobsOptions = {}
): UseListJobsResult {
    const [data, setData] = useState<ListJobsDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (executeOptions?: { limit?: number; offset?: number }) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: ListJobsCommand = {
                    limit: executeOptions?.limit ?? options.limit,
                    offset: executeOptions?.offset ?? options.offset ?? 0,
                };
                const result = await handler.execute(command);

                if (result.isSuccess()) {
                    setData(result.value);
                } else {
                    setError(result.error);
                }
            } catch (err) {
                setError(err as Error);
            } finally {
                setIsLoading(false);
            }
        },
        [handler, options.limit, options.offset]
    );

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setIsLoading(false);
    }, []);

    // Auto-fetch on mount if requested
    useEffect(() => {
        if (options.autoFetch) {
            execute();
        }
    }, [options.autoFetch, execute]);

    return { data, isLoading, error, execute, reset };
}
