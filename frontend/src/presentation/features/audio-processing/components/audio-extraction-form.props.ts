/**
 * Audio Extraction Form component props
 */

export interface AudioExtractionFormProps {
    readonly onExtract: (videoPath: string, outputPath: string, options: AudioExtractionOptions) => void;
    readonly isLoading?: boolean;
}

export interface AudioExtractionOptions {
    readonly format?: 'wav' | 'mp3';
    readonly sampleRate?: number;
}
