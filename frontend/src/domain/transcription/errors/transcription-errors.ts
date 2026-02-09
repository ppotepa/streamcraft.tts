/**
 * Transcription domain errors.
 */

import { DomainError, ValidationError } from '@domain/shared/errors';

export class TranscriptionFailedError extends DomainError {
    readonly code = 'TRANSCRIPTION_FAILED';

    constructor(
        public readonly audioPath: string,
        public readonly reason: string
    ) {
        super(`Failed to transcribe ${audioPath}: ${reason}`);
    }
}

export class InvalidSubtitleFormatError extends ValidationError {
    readonly code = 'INVALID_SUBTITLE_FORMAT';

    constructor(formatValue: string, reason: string) {
        super('subtitle_format', formatValue, `Invalid subtitle format: ${reason}`);
    }
}
