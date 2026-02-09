/**
 * React hook for CompleteJobStep use case
 */

import { useState, useCallback } from 'react';
import {
    CompleteJobStepHandler,
    CompleteJobStepCommand,
    CompleteJobStepDto,
} from '../../../application/job/complete-job-step';
import { JobId } from '../../../domain/job/value-objects/job-id';

export interface UseCompleteJobStepResult {
    data: CompleteJobStepDto | null;
    isLoading: boolean;
    error: Error | null;
    execute: (jobId: JobId, stepName: string) => Promise<void>;
    reset: () => void;
}

export function useCompleteJobStep(
    handler: CompleteJobStepHandler
): UseCompleteJobStepResult {
    const [data, setData] = useState<CompleteJobStepDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (jobId: JobId, stepName: string) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: CompleteJobStepCommand = { jobId, stepName };
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
