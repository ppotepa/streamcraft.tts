/**
 * Additional Use Case Hooks
 * Hooks for job actions, transcription operations, and dataset management
 */

import { useState, useCallback } from 'react';
import { CancelJobHandler } from '../../../application/job/handlers/cancel-job-handler';
import { RetryJobHandler } from '../../../application/job/handlers/retry-job-handler';
import { FilterTranscriptCuesHandler } from '../../../application/transcription/handlers/filter-transcript-cues-handler';
import { ParseSubtitlesHandler } from '../../../application/transcription/handlers/parse-subtitles-handler';
import { ValidateDatasetHandler } from '../../../application/dataset/handlers/validate-dataset-handler';
import { SplitDatasetHandler } from '../../../application/dataset/handlers/split-dataset-handler';
import type { Result } from '../../../domain/shared/result';

/**
 * Hook for canceling a job
 */
export const useCancelJob = (handler: CancelJobHandler) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (jobId: string) => {
            setIsLoading(true);
            setError(null);

            const result = await handler.execute({ jobId });

            if (result.isErr()) {
                setError(result.error);
            }

            setIsLoading(false);
            return result;
        },
        [handler]
    );

    return { execute, isLoading, error };
};

/**
 * Hook for retrying a failed job
 */
export const useRetryJob = (handler: RetryJobHandler) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (jobId: string) => {
            setIsLoading(true);
            setError(null);

            const result = await handler.execute({ jobId });

            if (result.isErr()) {
                setError(result.error);
            }

            setIsLoading(false);
            return result;
        },
        [handler]
    );

    return { execute, isLoading, error };
};

/**
 * Hook for filtering transcript cues
 */
export const useFilterTranscriptCues = (handler: FilterTranscriptCuesHandler) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (transcriptionId: string, minConfidence?: number, maxDuration?: number) => {
            setIsLoading(true);
            setError(null);

            const result = await handler.execute({
                transcriptionId,
                minConfidence,
                maxDuration,
            });

            if (result.isErr()) {
                setError(result.error);
            }

            setIsLoading(false);
            return result;
        },
        [handler]
    );

    return { execute, isLoading, error };
};

/**
 * Hook for parsing subtitles
 */
export const useParseSubtitles = (handler: ParseSubtitlesHandler) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (subtitlePath: string, format?: 'srt' | 'vtt' | 'auto') => {
            setIsLoading(true);
            setError(null);

            const result = await handler.execute({ subtitlePath, format });

            if (result.isErr()) {
                setError(result.error);
            }

            setIsLoading(false);
            return result;
        },
        [handler]
    );

    return { execute, isLoading, error };
};

/**
 * Hook for validating a dataset
 */
export const useValidateDataset = (handler: ValidateDatasetHandler) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (datasetId: string) => {
            setIsLoading(true);
            setError(null);

            const result = await handler.execute({ datasetId });

            if (result.isErr()) {
                setError(result.error);
            }

            setIsLoading(false);
            return result;
        },
        [handler]
    );

    return { execute, isLoading, error };
};

/**
 * Hook for splitting a dataset
 */
export const useSplitDataset = (handler: SplitDatasetHandler) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (
            datasetId: string,
            trainRatio: number = 0.8,
            validationRatio: number = 0.1,
            testRatio: number = 0.1
        ) => {
            setIsLoading(true);
            setError(null);

            const result = await handler.execute({
                datasetId,
                trainRatio,
                validationRatio,
                testRatio,
            });

            if (result.isErr()) {
                setError(result.error);
            }

            setIsLoading(false);
            return result;
        },
        [handler]
    );

    return { execute, isLoading, error };
};
