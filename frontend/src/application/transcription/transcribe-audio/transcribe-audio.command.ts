/**
 * Transcribe audio use case - Command
 */

export interface TranscribeAudioCommand {
    readonly audioPath: string;
    readonly model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
    readonly language?: string;
}
