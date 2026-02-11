/**
 * Twitch API utilities
 */

/**
 * Fetch Twitch broadcaster avatar URL from username
 * Uses Twitch's static CDN - no auth required
 * 
 * @param broadcasterLogin - Twitch username (e.g., "shroud", "xqc")
 * @returns Avatar URL (300x300) or null if fetch fails
 */
export async function fetchTwitchAvatar(broadcasterLogin: string): Promise<string | null> {
    if (!broadcasterLogin || broadcasterLogin === 'unknown') {
        console.warn('[Twitch] Invalid broadcaster login:', broadcasterLogin);
        return null;
    }

    // Twitch static CDN pattern
    const avatarUrl = `https://static-cdn.jtvnw.net/jtv_user_pictures/${broadcasterLogin}-profile_image-300x300.png`;
    console.log('[Twitch] Checking avatar URL:', avatarUrl);

    try {
        // Verify the image exists with a HEAD request
        const response = await fetch(avatarUrl, { method: 'HEAD' });
        console.log('[Twitch] Avatar HEAD response:', response.status, response.ok);
        if (response.ok) {
            return avatarUrl;
        }
        return null;
    } catch (error) {
        console.warn(`[Twitch] Failed to fetch avatar for ${broadcasterLogin}:`, error);
        return null;
    }
}

/**
 * Extract broadcaster login from VOD URL
 * Supports Twitch video URLs like:
 * - https://www.twitch.tv/videos/123456789
 * - https://twitch.tv/videos/123456789
 * 
 * @param vodUrl - Twitch VOD URL
 * @returns Broadcaster login extracted from metadata, or null if not available
 */
export function extractBroadcasterFromVodUrl(vodUrl: string): string | null {
    // Note: This is a fallback - prefer getting broadcaster from API metadata
    // Twitch video URLs don't directly contain the broadcaster name
    return null;
}

/**
 * Build avatar URL without verification (optimistic)
 * Use this when you already know the broadcaster exists
 * 
 * @param broadcasterLogin - Twitch username
 * @returns Avatar URL
 */
export function getTwitchAvatarUrl(broadcasterLogin: string): string {
    return `https://static-cdn.jtvnw.net/jtv_user_pictures/${broadcasterLogin}-profile_image-300x300.png`;
}

/**
 * Cache for avatar URLs to avoid repeated fetches
 */
const avatarCache = new Map<string, string | null>();

/**
 * Fetch Twitch avatar with caching
 * 
 * @param broadcasterLogin - Twitch username
 * @returns Avatar URL or null, cached for subsequent calls
 */
export async function fetchTwitchAvatarCached(broadcasterLogin: string): Promise<string | null> {
    if (avatarCache.has(broadcasterLogin)) {
        const cached = avatarCache.get(broadcasterLogin) || null;
        console.log('[Twitch] Using cached avatar for', broadcasterLogin, ':', cached);
        return cached;
    }

    const avatarUrl = await fetchTwitchAvatar(broadcasterLogin);
    console.log('[Twitch] Caching avatar for', broadcasterLogin, ':', avatarUrl);
    avatarCache.set(broadcasterLogin, avatarUrl);
    return avatarUrl;
}

/**
 * Clear avatar cache
 */
export function clearAvatarCache(): void {
    avatarCache.clear();
}
