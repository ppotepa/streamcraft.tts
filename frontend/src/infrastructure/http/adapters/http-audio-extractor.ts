/**
 * HTTP-based Audio Extractor implementation
 * Communicates with backend API to extract audio from video
 */

import { Result, ok, err } from '../../../domain/shared/result';
import { AudioFile } from '../../../domain/audio/entities/audio-file';
import { AudioExtractor } from '../../../domain/audio/ports/audio-extractor';
import { HttpClient } from '../client/http-client';

export class HttpAudioExtractor implements AudioExtractor {
    constructor(private httpClient: HttpClient) { }

    async extract(
        videoPath: string,
        outputPath: string,
        format?: string,
        sampleRate?: number
    ): Promise<Result<AudioFile, Error>> {
        try {
            const response = await this.httpClient.post<{
                audio_file_id: string;
                output_path: string;
                duration_seconds: number;
                size_megabytes: number;
                sample_rate_hz: number;
                format: string;
            }>('/audio/extract', {
                video_path: videoPath,
                output_path: outputPath,
                format: format || 'wav',
                sample_rate: sampleRate,
            });

            if (response.isErr()) {
                return err(response.error);
            }

            const data = response.value;
            // Create AudioFile entity from response
            // Note: This is a simplified version. Real implementation would use proper entity creation
            const audioFile: AudioFile = {
                id: data.audio_file_id,
                path: data.output_path,
                duration: data.duration_seconds,
                sampleRate: data.sample_rate_hz,
                format: data.format,
            } as AudioFile;

            return ok(audioFile);
        } catch (error) {
            return err(
                error instanceof Error ? error : new Error('Failed to extract audio')
            );
        }
    }
}
