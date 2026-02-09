/**
 * Audio format value object.
 */

export enum AudioFormat {
    WAV = 'wav',
    AAC = 'aac',
    PCM = 'pcm',
    MP3 = 'mp3',
    FLAC = 'flac',
}

export function getAudioFormatExtension(format: AudioFormat): string {
    return `.${format}`;
}

export function isLosslessFormat(format: AudioFormat): boolean {
    return format === AudioFormat.WAV || format === AudioFormat.PCM || format === AudioFormat.FLAC;
}
