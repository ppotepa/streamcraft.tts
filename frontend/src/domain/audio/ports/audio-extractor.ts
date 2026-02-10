/**
 * Audio extractor port.
 */

import { Result } from '../../shared/result';
import { AudioFile } from '../entities/audio-file.entity';
import { ExtractionFailedError } from '../errors/audio-errors';

export interface AudioExtractor {
    extract(
        videoPath: string,
        outputPath: string,
        audioOnly?: boolean
    ): Promise<Result<AudioFile, ExtractionFailedError>>;
}
