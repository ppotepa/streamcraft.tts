/**
 * VOD Metadata Entity
 */

import { VodId } from '../value-objects/vod-id';
import { Platform } from '../value-objects/platform';

export interface VodMetadata {
    readonly vodId: VodId;
    readonly platform: Platform;
    readonly streamer: string;
    readonly title: string;
    readonly durationSeconds: number;
    readonly previewUrl: string | null;
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
