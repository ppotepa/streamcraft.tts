/**
 * Whisper model value object.
 */

export enum WhisperModel {
    TINY = 'tiny',
    BASE = 'base',
    SMALL = 'small',
    MEDIUM = 'medium',
    LARGE = 'large',
    LARGE_V2 = 'large-v2',
    LARGE_V3 = 'large-v3',
}

export function getModelSizeMb(model: WhisperModel): number {
    const sizes: Record<WhisperModel, number> = {
        [WhisperModel.TINY]: 39,
        [WhisperModel.BASE]: 74,
        [WhisperModel.SMALL]: 244,
        [WhisperModel.MEDIUM]: 769,
        [WhisperModel.LARGE]: 1550,
        [WhisperModel.LARGE_V2]: 1550,
        [WhisperModel.LARGE_V3]: 1550,
    };
    return sizes[model];
}

export function isLargeModel(model: WhisperModel): boolean {
    return (
        model === WhisperModel.LARGE ||
        model === WhisperModel.LARGE_V2 ||
        model === WhisperModel.LARGE_V3
    );
}

export function getDisplayName(model: WhisperModel): string {
    return model.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}
