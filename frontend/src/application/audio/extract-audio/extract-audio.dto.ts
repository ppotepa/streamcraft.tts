/**
 * Extract audio use case - DTO
 */

export interface ExtractAudioDto {
    readonly audioPath: string;
    readonly format: string;
    readonly sampleRate: number;
    readonly durationSeconds: number;
    readonly fileSizeBytes: number;
}
