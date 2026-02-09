/**
 * Extract audio use case - Command
 */

export interface ExtractAudioCommand {
    readonly videoPath: string;
    readonly outputPath: string;
    readonly format?: 'wav' | 'mp3';
    readonly sampleRate?: number;
}
