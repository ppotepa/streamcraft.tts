/**
 * HTTP VOD Repository Adapter
 */

import { Result, Ok, Err } from '../../../domain/shared/result';
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
    description?: string | null;
    url?: string | null;
    viewCount?: number | null;
    createdAt?: string | null;
    publishedAt?: string | null;
    language?: string | null;
    userId?: string | null;
    userLogin?: string | null;
    videoType?: string | null;
    gameId?: string | null;
    gameName?: string | null;
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
                    vod_id: vodId,
                    platform,
                }
            );

            if (!response.ok) {
                return Err(new Error('Failed to fetch VOD metadata'));
            }

            const raw = response.value.data as VodMetadataDto & {
                vod_id?: string;
                duration_seconds?: number;
                preview_url?: string | null;
                view_count?: number | null;
                created_at?: string | null;
                published_at?: string | null;
                user_id?: string | null;
                user_login?: string | null;
                video_type?: string | null;
                game_id?: string | null;
                game_name?: string | null;
            };

            const dto: VodMetadataDto = {
                vodId: raw.vodId ?? raw.vod_id ?? '',
                streamer: raw.streamer,
                title: raw.title,
                durationSeconds: Number(raw.durationSeconds ?? raw.duration_seconds ?? 0),
                previewUrl: raw.previewUrl ?? raw.preview_url ?? null,
                platform: raw.platform,
                description: raw.description ?? null,
                url: raw.url ?? null,
                viewCount: raw.viewCount ?? raw.view_count ?? null,
                createdAt: raw.createdAt ?? raw.created_at ?? null,
                publishedAt: raw.publishedAt ?? raw.published_at ?? null,
                language: raw.language ?? null,
                userId: raw.userId ?? raw.user_id ?? null,
                userLogin: raw.userLogin ?? raw.user_login ?? null,
                videoType: raw.videoType ?? raw.video_type ?? null,
                gameId: raw.gameId ?? raw.game_id ?? null,
                gameName: raw.gameName ?? raw.game_name ?? null,
            };
            const metadata: VodMetadata = {
                vodId: dto.vodId,
                platform: dto.platform as Platform,
                streamer: dto.streamer,
                title: dto.title,
                durationSeconds: dto.durationSeconds,
                previewUrl: dto.previewUrl,
                description: dto.description ?? null,
                url: dto.url ?? null,
                viewCount: dto.viewCount ?? null,
                createdAt: dto.createdAt ?? null,
                publishedAt: dto.publishedAt ?? null,
                language: dto.language ?? null,
                userId: dto.userId ?? null,
                userLogin: dto.userLogin ?? null,
                videoType: dto.videoType ?? null,
                gameId: dto.gameId ?? null,
                gameName: dto.gameName ?? null,
            };

            return Ok(metadata);
        } catch (error) {
            return Err(
                new Error(`Failed to fetch VOD metadata: ${error}`)
            );
        }
    }
}
