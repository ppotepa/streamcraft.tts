/**
 * Fetch VOD metadata use case - DTO
 */

import { Platform } from '../../../domain/vod/value-objects/platform';

export interface FetchVodMetadataDto {
    readonly vodId: string;
    readonly streamer: string;
    readonly title: string;
    readonly durationSeconds: number;
    readonly previewUrl: string | null;
    readonly platform: Platform;
    readonly description?: string | null;
    readonly url?: string | null;
    readonly viewCount?: number | null;
    readonly createdAt?: string | null;
    readonly publishedAt?: string | null;
    readonly language?: string | null;
    readonly userId?: string | null;
    readonly userLogin?: string | null;
    readonly videoType?: string | null;
    readonly gameId?: string | null;
    readonly gameName?: string | null;
}
