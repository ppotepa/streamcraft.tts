/**
 * HTTP-based Transcriber implementation
 * Communicates with backend API to transcribe audio files
 */

import { Result, Ok, Err } from '../../../domain/shared/result';
import { Transcript } from '../../../domain/transcription/entities/transcript';
import { Transcriber } from '../../../domain/transcription/ports/transcriber';
import { HttpClient } from '../client/http-client';

export class HttpTranscriber implements Transcriber {
    constructor(private httpClient: HttpClient) { }

    async transcribe(
        audioPath: string,
        model: string,
        language?: string
    ): Promise<Result<Transcript, Error>> {
        try {
            const response = await this.httpClient.post<{
                transcription_id: string;
                audio_path: string;
                model: string;
                language: string | null;
                total_cues: number;
                cues: Array<{
                    start_seconds: number;
                    end_seconds: number;
                    text: string;
                    confidence: number | null;
                }>;
                created_at: string;
            }>('/transcriptions/transcribe', {
                audio_path: audioPath,
                model,
                language,
            });

            if (!response.ok) {
                return Err(response.error);
            }

            const data = response.value.data;
            // Create Transcript entity from response
            // Note: This is a simplified version. Real implementation would use proper entity creation
            const transcript: Transcript = {
                transcriptionId: data.transcription_id,
                audioPath: data.audio_path,
                model: data.model,
                language: data.language,
                cues: data.cues.map((cue) => ({
                    startSeconds: cue.start_seconds,
                    endSeconds: cue.end_seconds,
                    text: cue.text,
                    confidence: cue.confidence,
                })),
                createdAt: new Date(data.created_at),
            } as Transcript;

            return Ok(transcript);
        } catch (error) {
            return Err(
                error instanceof Error ? error : new Error('Failed to transcribe audio')
            );
        }
    }
}
