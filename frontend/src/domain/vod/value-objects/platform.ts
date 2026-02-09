/**
 * Platform value object.
 */

export enum Platform {
    Twitch = 'twitch',
    YouTube = 'youtube',
}

export const getDisplayName = (platform: Platform): string => {
    switch (platform) {
        case Platform.Twitch:
            return 'Twitch';
        case Platform.YouTube:
            return 'YouTube';
    }
};

export const fromString = (value: string): Platform | null => {
    const normalized = value.toLowerCase();
    if (normalized === 'twitch') return Platform.Twitch;
    if (normalized === 'youtube') return Platform.YouTube;
    return null;
};
