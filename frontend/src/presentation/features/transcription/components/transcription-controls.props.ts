/**
 * Transcription Controls component props
 */

export interface TranscriptionControlsProps {
    readonly onStartTranscription: (audioPath: string, options: TranscriptionOptions) => void;
    readonly isTranscribing?: boolean;
}

export interface TranscriptionOptions {
    readonly model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
    readonly language?: string;
}
