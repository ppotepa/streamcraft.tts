/**
 * Branded types for domain identifiers.
 *
 * These types provide compile-time type safety by preventing mixing of different ID types.
 * The unique symbol ensures types cannot be accidentally interchanged.
 */

declare const __brand: unique symbol;

type Brand<T, TBrand> = T & { readonly [__brand]: TBrand };

// Job domain
export type JobId = Brand<string, 'JobId'>;
export type StepId = Brand<string, 'StepId'>;

// VOD domain
export type VodId = Brand<string, 'VodId'>;
export type StreamerId = Brand<string, 'StreamerId'>;

// Audio domain
export type AudioFileId = Brand<string, 'AudioFileId'>;
export type SegmentId = Brand<string, 'SegmentId'>;

// Dataset domain
export type DatasetId = Brand<string, 'DatasetId'>;
export type EntryId = Brand<string, 'EntryId'>;

// Transcription domain
export type TranscriptId = Brand<string, 'TranscriptId'>;
export type CueId = Brand<string, 'CueId'>;

// Factory functions with validation
export const createJobId = (value: string): JobId => {
    if (!value || typeof value !== 'string') {
        throw new Error('JobId must be a non-empty string');
    }
    return value as JobId;
};

export const createVodId = (value: string): VodId => {
    if (!value || typeof value !== 'string') {
        throw new Error('VodId must be a non-empty string');
    }
    return value as VodId;
};

export const createSegmentId = (value: string): SegmentId => {
    if (!value || typeof value !== 'string') {
        throw new Error('SegmentId must be a non-empty string');
    }
    return value as SegmentId;
};

// Type guard helpers
export const isJobId = (value: unknown): value is JobId => {
    return typeof value === 'string' && value.length > 0;
};

export const isVodId = (value: unknown): value is VodId => {
    return typeof value === 'string' && value.length > 0;
};
