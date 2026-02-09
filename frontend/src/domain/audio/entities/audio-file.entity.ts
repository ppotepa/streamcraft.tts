/**
 * Audio file entity.
 */

import { AudioFileId } from '@domain/shared/branded-types';
import { Duration } from '@domain/shared/value-objects';
import { AudioFormat } from '../value-objects/audio-format';
import { SampleRate } from '../value-objects/sample-rate';

export interface AudioFile {
    readonly id: AudioFileId;
    readonly path: string;
    readonly format: AudioFormat;
    readonly sampleRate: SampleRate;
    readonly duration: Duration;
    readonly sizeBytes: number;
    readonly channels: number;
}

export function createAudioFile(params: {
    id: AudioFileId;
    path: string;
    format: AudioFormat;
    sampleRate: SampleRate;
    duration: Duration;
    sizeBytes: number;
    channels?: number;
}): AudioFile {
    const channels = params.channels ?? 1;

    if (params.sizeBytes < 0) {
        throw new Error('File size cannot be negative');
    }
    if (channels < 1) {
        throw new Error('Channels must be at least 1');
    }
    if (channels > 8) {
        throw new Error('Channels cannot exceed 8');
    }

    return {
        id: params.id,
        path: params.path,
        format: params.format,
        sampleRate: params.sampleRate,
        duration: params.duration,
        sizeBytes: params.sizeBytes,
        channels,
    };
}

export function isMono(audioFile: AudioFile): boolean {
    return audioFile.channels === 1;
}

export function isStereo(audioFile: AudioFile): boolean {
    return audioFile.channels === 2;
}

export function getMegabytes(audioFile: AudioFile): number {
    return audioFile.sizeBytes / (1024 * 1024);
}
