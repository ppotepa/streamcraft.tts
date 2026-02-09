/**
 * React hook for ExportDataset use case
 */

import { useState, useCallback } from 'react';
import {
    ExportDatasetHandler,
    ExportDatasetCommand,
    ExportDatasetDto,
} from '../../../application/dataset/export-dataset';
import { DatasetId } from '../../../domain/dataset/value-objects/dataset-id';
import { DatasetFormat } from '../../../domain/dataset/value-objects/dataset-format';

export interface UseExportDatasetResult {
    data: ExportDatasetDto | null;
    isLoading: boolean;
    error: Error | null;
    execute: (datasetId: DatasetId, outputPath: string, format: DatasetFormat) => Promise<void>;
    reset: () => void;
}

export function useExportDataset(
    handler: ExportDatasetHandler
): UseExportDatasetResult {
    const [data, setData] = useState<ExportDatasetDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (datasetId: DatasetId, outputPath: string, format: DatasetFormat) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: ExportDatasetCommand = { datasetId, outputPath, format };
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
