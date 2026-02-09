/**
 * React hook for FetchVodMetadata use case
 */

import { useState, useCallback } from 'react';
import { FetchVodMetadataHandler, FetchVodMetadataCommand, FetchVodMetadataDto } from '../../../application/vod/fetch-vod-metadata';
import { VodId } from '../../../domain/vod/value-objects/vod-id';
import { Platform } from '../../../domain/vod/value-objects/platform';

export interface UseFetchVodMetadataResult {
    data: FetchVodMetadataDto | null;
    isLoading: boolean;
    error: Error | null;
    execute: (vodId: VodId, platform: Platform) => Promise<void>;
    reset: () => void;
}

export function useFetchVodMetadata(
    handler: FetchVodMetadataHandler
): UseFetchVodMetadataResult {
    const [data, setData] = useState<FetchVodMetadataDto | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
        async (vodId: VodId, platform: Platform) => {
            setIsLoading(true);
            setError(null);

            try {
                const command: FetchVodMetadataCommand = { vodId, platform };
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
