/**
 * React hook for ExtractAudio use case
 */

import { useState, useCallback } from 'react';
import {
    ExtractAudioHandler,
    ExtractAudioCommand,
    ExtractAudioDto,
} from '../../../application/audio/extract-audio';

export interface UseExtractAudioResult {
    data: ExtractAudioDto | null;
    isLoading: boolean;
    error: Error | null;
    execute: (videoPath: string, outputPath: string, options?: { format?: 'wav' | 'mp3'; sampleRate?: number }) => Promise<void>;
    reset: () => void;
}

export function useExtractAudio(
    handler: ExtractAudioHandler
): UseExtractAudioResult {
    const [data, setData] = useState<ExtractAudioDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (
            videoPath: string,
            outputPath: string,
            options?: { format?: 'wav' | 'mp3'; sampleRate?: number }
        ) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: ExtractAudioCommand = {
                    videoPath,
                    outputPath,
                    format: options?.format,
                    sampleRate: options?.sampleRate,
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
