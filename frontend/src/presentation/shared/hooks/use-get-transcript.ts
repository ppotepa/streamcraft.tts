/**
 * React hook for GetTranscript use case
 */

import { useState, useCallback } from 'react';
import {
    GetTranscriptHandler,
    GetTranscriptCommand,
    GetTranscriptDto,
} from '../../../application/transcription/get-transcript';
import { TranscriptionId } from '../../../domain/transcription/value-objects/transcription-id';

export interface UseGetTranscriptResult {
    data: GetTranscriptDto | null;
    isLoading: boolean;
    error: Error | null;
    execute: (transcriptionId: TranscriptionId) => Promise<void>;
    reset: () => void;
}

export function useGetTranscript(
    handler: GetTranscriptHandler
): UseGetTranscriptResult {
    const [data, setData] = useState<GetTranscriptDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (transcriptionId: TranscriptionId) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: GetTranscriptCommand = { transcriptionId };
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
