/**
 * VOD URL value object with validation.
 */

import { ValidationError } from '../../shared/errors';
import { Platform } from './platform';

export class VodUrl {
    private constructor(
        readonly url: string,
        readonly platform: Platform
    ) {
        this.validate();
    }

    private validate(): void {
        if (!this.url) {
            throw new ValidationError('vod_url', this.url, 'URL cannot be empty');
        }

        if (this.platform === Platform.Twitch) {
            const twitchPattern = /https?:\/\/(www\.)?twitch\.tv\/videos\/\d+/;
            if (!twitchPattern.test(this.url)) {
                throw new ValidationError(
                    'vod_url',
                    this.url,
                    'Invalid Twitch URL format. Expected: twitch.tv/videos/[id]'
                );
            }
        } else if (this.platform === Platform.YouTube) {
            const youtubePattern =
                /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;
            if (!youtubePattern.test(this.url)) {
                throw new ValidationError(
                    'vod_url',
                    this.url,
                    'Invalid YouTube URL format. Expected: youtube.com/watch?v=[id]'
                );
            }
        }
    }

    static create(url: string, platform: Platform): VodUrl {
        return new VodUrl(url, platform);
    }

    static fromString(url: string): VodUrl {
        if (url.includes('twitch.tv')) {
            return new VodUrl(url, Platform.Twitch);
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return new VodUrl(url, Platform.YouTube);
        } else {
            throw new ValidationError(
                'vod_url',
                url,
                'Cannot detect platform from URL'
            );
        }
    }

    extractId(): string {
        if (this.platform === Platform.Twitch) {
            const match = this.url.match(/\/videos\/(\d+)/);
            return match?.[1] ?? '';
        } else if (this.platform === Platform.YouTube) {
            const match = this.url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
            return match?.[1] ?? '';
        }
        return '';
    }

    equals(other: VodUrl): boolean {
        return this.url === other.url && this.platform === other.platform;
    }
}
