/**
 * React hook for StartJobStep use case
 */

import { useState, useCallback } from 'react';
import {
    StartJobStepHandler,
    StartJobStepCommand,
    StartJobStepDto,
} from '../../../application/job/start-job-step';
import { JobId } from '../../../domain/job/value-objects/job-id';

export interface UseStartJobStepResult {
    data: StartJobStepDto | null;
    isLoading: boolean;
    error: Error | null;
    execute: (jobId: JobId, stepName: string) => Promise<void>;
    reset: () => void;
}

export function useStartJobStep(
    handler: StartJobStepHandler
): UseStartJobStepResult {
    const [data, setData] = useState<StartJobStepDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (jobId: JobId, stepName: string) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: StartJobStepCommand = { jobId, stepName };
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
