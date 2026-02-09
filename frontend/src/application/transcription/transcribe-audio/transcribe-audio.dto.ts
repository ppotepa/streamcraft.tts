/**
 * Transcribe audio use case - DTO
 */

export interface CueDto {
    readonly startTimeSeconds: number;
    readonly endTimeSeconds: number;
    readonly text: string;
    readonly confidence: number | null;
}

export interface TranscribeAudioDto {
    readonly transcriptionId: string;
    readonly audioPath: string;
    readonly cues: readonly CueDto[];
    readonly totalCues: number;
    readonly language: string | null;
    readonly model: string;
}
