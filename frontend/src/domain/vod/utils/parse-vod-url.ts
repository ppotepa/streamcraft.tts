/**
 * VOD URL parsing utilities
 */

export interface ParsedVodUrl {
    vodId: string;
    platform: 'twitch' | 'youtube';
}

/**
 * Parse a VOD URL to extract ID and platform
 * 
 * Supports:
 * - Twitch: https://www.twitch.tv/videos/2689875280
 * - YouTube: https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - YouTube shorts: https://youtu.be/dQw4w9WgXcQ
 */
export function parseVodUrl(url: string): ParsedVodUrl | null {
    const trimmedUrl = url.trim();

    // Twitch VOD
    const twitchMatch = trimmedUrl.match(/twitch\.tv\/videos\/(\d+)/);
    if (twitchMatch) {
        return {
            vodId: twitchMatch[1],
            platform: 'twitch',
        };
    }

    // YouTube watch URL
    const youtubeMatch = trimmedUrl.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]+)/);
    if (youtubeMatch) {
        return {
            vodId: youtubeMatch[1],
            platform: 'youtube',
        };
    }

    // YouTube short URL
    const youtubeShortMatch = trimmedUrl.match(/youtu\.be\/([A-Za-z0-9_-]+)/);
    if (youtubeShortMatch) {
        return {
            vodId: youtubeShortMatch[1],
            platform: 'youtube',
        };
    }

    return null;
}

/**
 * Validate if a string is a valid VOD URL
 */
export function isValidVodUrl(url: string): boolean {
    return parseVodUrl(url) !== null;
}
