/**
 * Get transcript use case - DTO
 */

export interface TranscriptCueDto {
    readonly startTimeSeconds: number;
    readonly endTimeSeconds: number;
    readonly text: string;
    readonly confidence: number | null;
}

export interface GetTranscriptDto {
    readonly transcriptionId: string;
    readonly audioPath: string;
    readonly cues: readonly TranscriptCueDto[];
    readonly totalCues: number;
    readonly language: string | null;
    readonly createdAt: string;
}
