/**
 * Audio Quality Display component props
 */

export interface AudioQualityDisplayProps {
    readonly rmsDb: number;
    readonly peakDb: number;
    readonly qualityScore: number;
    readonly isSilence: boolean;
    readonly isClipping: boolean;
}
