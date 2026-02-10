/**
 * VOD Metadata Card component props
 */

export interface VodMetadataCardProps {
    readonly vodId: string;
    readonly streamer: string;
    readonly title: string;
    readonly durationSeconds: number;
    readonly previewUrl: string | null;
    readonly platform: 'twitch' | 'youtube';
    readonly description?: string | null;
    readonly url?: string | null;
    readonly viewCount?: number | null;
    readonly createdAt?: string | null;
    readonly publishedAt?: string | null;
    readonly language?: string | null;
    readonly userLogin?: string | null;
    readonly videoType?: string | null;
    readonly gameName?: string | null;
    readonly onCreateJob?: (vodId: string) => void;
}
