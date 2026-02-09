/**
 * Cue entity (subtitle/transcript cue).
 */

import { CueId } from '@domain/shared/branded-types';
import { TimeRange } from '@domain/audio/value-objects/time-range';
import { ConfidenceScore } from '../value-objects/confidence-score';
import { TranscriptText } from '../value-objects/transcript-text';

export interface Cue {
    readonly id: CueId;
    readonly timeRange: TimeRange;
    readonly text: TranscriptText;
    readonly confidence?: ConfidenceScore;
}

export function createCue(params: {
    id: CueId;
    timeRange: TimeRange;
    text: TranscriptText;
    confidence?: ConfidenceScore;
}): Cue {
    return {
        id: params.id,
        timeRange: params.timeRange,
        text: params.text,
        confidence: params.confidence,
    };
}

export function getCueDurationSeconds(cue: Cue): number {
    return cue.timeRange.duration;
}

export function getCueWordCount(cue: Cue): number {
    return cue.text.wordCount;
}

export function isReliableCue(cue: Cue, threshold: number = 0.8): boolean {
    if (!cue.confidence) {
        return true; // No confidence info = assume reliable
    }
    return cue.confidence.isHigh(threshold);
}
