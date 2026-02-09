/**
 * React hook for TranscribeAudio use case
 */

import { useState, useCallback } from 'react';
import {
    TranscribeAudioHandler,
    TranscribeAudioCommand,
    TranscribeAudioDto,
} from '../../../application/transcription/transcribe-audio';

export interface UseTranscribeAudioResult {
    data: TranscribeAudioDto | null;
    isLoading: boolean;
    error: Error | null;
    execute: (audioPath: string, options?: { model?: string; language?: string }) => Promise<void>;
    reset: () => void;
}

export function useTranscribeAudio(
    handler: TranscribeAudioHandler
): UseTranscribeAudioResult {
    const [data, setData] = useState<TranscribeAudioDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (
            audioPath: string,
            options?: { model?: string; language?: string }
        ) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: TranscribeAudioCommand = {
                    audioPath,
                    model: options?.model as any,
                    language: options?.language,
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
        [handler]
    );

    const reset = useCallback(() => {
        setData(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return { data, isLoading, error, execute, reset };
}
