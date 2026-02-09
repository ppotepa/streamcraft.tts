/**
 * React hook for CreateDataset use case
 */

import { useState, useCallback } from 'react';
import {
    CreateDatasetHandler,
    CreateDatasetCommand,
    CreateDatasetDto,
    DatasetEntryInput,
} from '../../../application/dataset/create-dataset';

export interface UseCreateDatasetResult {
    data: CreateDatasetDto | null;
    isLoading: boolean;
    error: Error | null;
    execute: (name: string, entries: readonly DatasetEntryInput[]) => Promise<void>;
    reset: () => void;
}

export function useCreateDataset(
    handler: CreateDatasetHandler
): UseCreateDatasetResult {
    const [data, setData] = useState<CreateDatasetDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (name: string, entries: readonly DatasetEntryInput[]) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: CreateDatasetCommand = { name, entries };
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
