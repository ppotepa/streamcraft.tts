/**
 * Fetch VOD metadata use case - Handler
 */

import { Result } from '../../../domain/shared/result';
import { VodMetadataFetcher } from '../../../domain/vod/ports/vod-metadata-fetcher';
import { FetchVodMetadataCommand } from './fetch-vod-metadata.command';
import { FetchVodMetadataDto } from './fetch-vod-metadata.dto';

export class FetchVodMetadataHandler {
    constructor(private readonly metadataFetcher: VodMetadataFetcher) { }

    async execute(
        command: FetchVodMetadataCommand
    ): Promise<Result<FetchVodMetadataDto, Error>> {
        // Fetch metadata from external API
        const metadataResult = await this.metadataFetcher.fetch(
            command.vodId,
            command.platform
        );

        if (metadataResult.isFailure()) {
            return Result.fail(metadataResult.error);
        }

        const metadata = metadataResult.value;

        // Create DTO
        const dto: FetchVodMetadataDto = {
            vodId: metadata.vodId,
            streamer: metadata.streamer,
            title: metadata.title,
            durationSeconds: metadata.durationSeconds,
            previewUrl: metadata.previewUrl,
            platform: metadata.platform,
            description: metadata.description ?? null,
            url: metadata.url ?? null,
            viewCount: metadata.viewCount ?? null,
            createdAt: metadata.createdAt ?? null,
            publishedAt: metadata.publishedAt ?? null,
            language: metadata.language ?? null,
            userId: metadata.userId ?? null,
            userLogin: metadata.userLogin ?? null,
            videoType: metadata.videoType ?? null,
            gameId: metadata.gameId ?? null,
            gameName: metadata.gameName ?? null,
        };

        return Result.ok(dto);
    }
}
