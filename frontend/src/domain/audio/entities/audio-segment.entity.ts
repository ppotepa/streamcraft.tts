/**
 * Audio segment entity.
 */

import { SegmentId } from '@domain/shared/branded-types';
import { RmsDb } from '../value-objects/rms-db';
import { TimeRange } from '../value-objects/time-range';

export interface AudioSegment {
    readonly id: SegmentId;
    readonly timeRange: TimeRange;
    readonly text: string;
    readonly rmsDb?: RmsDb;
    readonly qualityScore?: number; // 0.0 to 1.0
}

export function createAudioSegment(params: {
    id: SegmentId;
    timeRange: TimeRange;
    text: string;
    rmsDb?: RmsDb;
    qualityScore?: number;
}): AudioSegment {
    if (!params.text.trim()) {
        throw new Error('Segment text cannot be empty');
    }
    if (params.qualityScore !== undefined && (params.qualityScore < 0 || params.qualityScore > 1)) {
        throw new Error('Quality score must be between 0.0 and 1.0');
    }

    return {
        id: params.id,
        timeRange: params.timeRange,
        text: params.text,
        rmsDb: params.rmsDb,
        qualityScore: params.qualityScore,
    };
}

export function getDurationSeconds(segment: AudioSegment): number {
    return segment.timeRange.duration;
}

export function isHighQuality(segment: AudioSegment, threshold: number = 0.7): boolean {
    return segment.qualityScore !== undefined && segment.qualityScore >= threshold;
}

export function withQuality(segment: AudioSegment, qualityScore: number, rmsDb: RmsDb): AudioSegment {
    return {
        ...segment,
        qualityScore,
        rmsDb,
    };
}
