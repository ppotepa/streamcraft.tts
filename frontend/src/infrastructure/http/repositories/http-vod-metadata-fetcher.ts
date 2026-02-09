/**
 * HTTP VOD Repository Adapter
 */

import { Result } from '../../../domain/shared/result';
import { VodMetadata } from '../../../domain/vod/entities/vod-metadata.entity';
import { VodId } from '../../../domain/vod/value-objects/vod-id';
import { Platform } from '../../../domain/vod/value-objects/platform';
import { VodMetadataFetcher } from '../../../domain/vod/ports/vod-metadata-fetcher';
import { HttpClient } from '../client/http-client';

interface VodMetadataDto {
    vodId: string;
    streamer: string;
    title: string;
    durationSeconds: number;
    previewUrl: string | null;
    platform: 'twitch' | 'youtube';
}

export class HttpVodMetadataFetcher implements VodMetadataFetcher {
    constructor(private readonly httpClient: HttpClient) { }

    async fetch(
        vodId: VodId,
        platform: Platform
    ): Promise<Result<VodMetadata, Error>> {
        try {
            const response = await this.httpClient.post<VodMetadataDto>(
                '/vods/metadata',
                {
                    vodId,
                    platform,
                }
            );

            if (response.isFailure()) {
                return Result.fail(new Error('Failed to fetch VOD metadata'));
            }

            const dto = response.value;
            const metadata = new VodMetadata(
                dto.vodId,
                dto.streamer,
                dto.title,
                dto.durationSeconds,
                dto.previewUrl,
                dto.platform as Platform
            );

            return Result.ok(metadata);
        } catch (error) {
            return Result.fail(
                new Error(`Failed to fetch VOD metadata: ${error}`)
            );
        }
    }
}
