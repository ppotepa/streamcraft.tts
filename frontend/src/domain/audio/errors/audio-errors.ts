/**
 * Audio domain errors.
 */

import { DomainError, ValidationError } from '@domain/shared/errors';

export class InvalidAudioFormatError extends ValidationError {
    readonly code = 'INVALID_AUDIO_FORMAT';

    constructor(formatValue: string, reason: string) {
        super('audio_format', formatValue, `Invalid audio format: ${reason}`);
    }
}

export class ExtractionFailedError extends DomainError {
    readonly code = 'EXTRACTION_FAILED';

    constructor(
        public readonly sourcePath: string,
        public readonly reason: string
    ) {
        super(`Failed to extract audio from ${sourcePath}: ${reason}`);
    }
}

export class SegmentInvalidError extends ValidationError {
    readonly code = 'SEGMENT_INVALID';

    constructor(field: string, value: number, reason: string) {
        super(field, value, `Invalid segment: ${reason}`);
    }
}
