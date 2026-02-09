/**
 * Transcriber port.
 */

import { Result } from '@domain/shared/result';
import { Transcript } from '../entities/transcript.entity';
import { TranscriptionFailedError } from '../errors/transcription-errors';
import { LanguageCode } from '../value-objects/language-code';
import { WhisperModel } from '../value-objects/whisper-model';

export interface Transcriber {
    transcribe(
        audioPath: string,
        language?: LanguageCode,
        model?: WhisperModel
    ): Promise<Result<Transcript, TranscriptionFailedError>>;
}
