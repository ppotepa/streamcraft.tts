/**
 * Transcript Cue List component props
 */

export interface TranscriptCue {
    readonly startTimeSeconds: number;
    readonly endTimeSeconds: number;
    readonly text: string;
    readonly confidence: number | null;
}

export interface TranscriptCueListProps {
    readonly cues: readonly TranscriptCue[];
    readonly onCueClick?: (cue: TranscriptCue, index: number) => void;
    readonly highlightedIndex?: number;
}
