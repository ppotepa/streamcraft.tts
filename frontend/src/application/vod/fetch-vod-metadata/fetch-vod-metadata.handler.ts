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
        };

        return Result.ok(dto);
    }
}
