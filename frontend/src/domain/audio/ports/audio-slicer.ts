/**
 * Audio slicer port.
 */

import { Result } from '@domain/shared/result';
import { AudioSegment } from '../entities/audio-segment.entity';
import { TimeRange } from '../value-objects/time-range';

export interface AudioSlicer {
    slice(
        audioPath: string,
        timeRange: TimeRange,
        outputPath: string
    ): Promise<Result<AudioSegment, Error>>;
}
