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
    readonly onCreateJob?: (vodId: string) => void;
}
