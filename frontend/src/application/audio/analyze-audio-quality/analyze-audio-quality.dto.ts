/**
 * Analyze audio quality use case - DTO
 */

export interface AnalyzeAudioQualityDto {
    readonly audioPath: string;
    readonly rmsDb: number;
    readonly qualityScore: number;
    readonly isSilence: boolean;
    readonly isClipping: boolean;
}
