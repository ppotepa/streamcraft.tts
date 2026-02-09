/**
 * React hook for CreateJob use case
 */

import { useState, useCallback } from 'react';
import { CreateJobHandler, CreateJobCommand, CreateJobDto } from '../../../application/job/create-job';

export interface UseCreateJobResult {
    data: CreateJobDto | null;
    isLoading: boolean;
    error: Error | null;
    execute: (vodUrl: string) => Promise<void>;
    reset: () => void;
}

export function useCreateJob(handler: CreateJobHandler): UseCreateJobResult {
    const [data, setData] = useState<CreateJobDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (vodUrl: string) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: CreateJobCommand = { vodUrl };
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
        [handler]
    );

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return { data, isLoading, error, execute, reset };
}
