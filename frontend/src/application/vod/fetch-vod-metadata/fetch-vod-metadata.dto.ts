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
}
