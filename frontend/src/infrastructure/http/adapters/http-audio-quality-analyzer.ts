/**
 * HTTP-based Audio Quality Analyzer implementation
 * Communicates with backend API to analyze audio quality
 */

import { Result, ok, err } from '../../../domain/shared/result';
import { AudioQualityMetrics } from '../../../domain/audio/entities/audio-quality-metrics';
import { AudioQualityAnalyzer } from '../../../domain/audio/ports/audio-quality-analyzer';
import { HttpClient } from '../client/http-client';

export class HttpAudioQualityAnalyzer implements AudioQualityAnalyzer {
    constructor(private httpClient: HttpClient) { }

    async analyze(audioPath: string): Promise<Result<AudioQualityMetrics, Error>> {
        try {
            const response = await this.httpClient.post<{
                rms_db: number;
                peak_db: number;
                silence_seconds: number;
                clipping_seconds: number;
            }>('/audio/analyze', {
                audio_path: audioPath,
            });

            if (response.isErr()) {
                return err(response.error);
            }

            const data = response.value;
            // Create AudioQualityMetrics from response
            // Note: This is a simplified version
            const metrics: AudioQualityMetrics = {
                rmsDb: data.rms_db,
                peakDb: data.peak_db,
                silenceSeconds: data.silence_seconds,
                clippingSeconds: data.clipping_seconds,
            } as AudioQualityMetrics;

            return ok(metrics);
        } catch (error) {
            return err(
                error instanceof Error ? error : new Error('Failed to analyze audio quality')
            );
        }
    }
}
