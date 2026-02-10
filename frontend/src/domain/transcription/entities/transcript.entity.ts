/**
 * Transcript entity.
 */

import type { TranscriptId } from '../../shared/branded-types';
import { TimeRange } from '../../audio/value-objects/time-range';
import type { Cue } from './cue.entity';
import { isReliableCue } from './cue.entity';
import type { LanguageCode } from '../value-objects/language-code';

export interface Transcript {
    readonly id: TranscriptId;
    readonly cues: readonly Cue[];
    readonly language: LanguageCode;
}

export function createTranscript(params: {
    id: TranscriptId;
    cues: readonly Cue[];
    language: LanguageCode;
}): Transcript {
    if (params.cues.length === 0) {
        throw new Error('Transcript must have at least one cue');
    }

    return {
        id: params.id,
        cues: params.cues,
        language: params.language,
    };
}

export function getTotalDuration(transcript: Transcript): number {
    if (transcript.cues.length === 0) {
        return 0;
    }
    return transcript.cues[transcript.cues.length - 1].timeRange.end;
}

export function getWordCount(transcript: Transcript): number {
    return transcript.cues.reduce((sum, cue) => sum + cue.text.wordCount, 0);
}

export function getCueCount(transcript: Transcript): number {
    return transcript.cues.length;
}

export function getCuesInRange(transcript: Transcript, start: number, end: number): readonly Cue[] {
    const queryRange = TimeRange.create(start, end);
    return transcript.cues.filter((cue) => cue.timeRange.overlaps(queryRange));
}

export function filterLowConfidence(transcript: Transcript, threshold: number = 0.8): Transcript {
    const filteredCues = transcript.cues.filter((cue) => isReliableCue(cue, threshold));
    return createTranscript({
        id: transcript.id,
        cues: filteredCues,
        language: transcript.language,
    });
}
