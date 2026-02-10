/**
 * Subtitle parser port.
 */

import { Result } from '../../shared/result';
import { Transcript } from '../entities/transcript.entity';
import { InvalidSubtitleFormatError } from '../errors/transcription-errors';

export interface SubtitleParser {
    parse(subtitlePath: string): Promise<Result<Transcript, InvalidSubtitleFormatError>>;
}
