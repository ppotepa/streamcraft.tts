/**
 * HTTP Transcription Repository Adapter
 */

import { Result, Ok, Err } from '../../../domain/shared';
import type { Transcript } from '../../../domain/transcription/entities/transcript.entity';
import type { Cue } from '../../../domain/transcription/entities/cue.entity';
import { createTranscript } from '../../../domain/transcription/entities/transcript.entity';
import { createCue } from '../../../domain/transcription/entities/cue.entity';
import { TranscriptId, CueId } from '../../../domain/shared/branded-types';
import { LanguageCode } from '../../../domain/transcription/value-objects/language-code';
import { TranscriptText } from '../../../domain/transcription/value-objects/transcript-text';
import { ConfidenceScore } from '../../../domain/transcription/value-objects/confidence-score';
import { TimeRange } from '../../../domain/audio/value-objects/time-range';
import { TranscriptionRepository } from '../../../domain/transcription/ports/transcription-repository';
import { TranscriptionNotFoundError } from '../../../domain/transcription/errors/transcription-errors';
import { HttpClient } from '../client/http-client';

interface CueDto {
    startTimeSeconds: number;
    endTimeSeconds: number;
    text: string;
    confidence: number | null;
}

interface TranscriptDto {
    transcriptionId: string;
    audioPath: string;
    cues: CueDto[];
    totalCues: number;
    language: string | null;
    createdAt: string;
}

export class HttpTranscriptionRepository implements TranscriptionRepository {
    constructor(private readonly httpClient: HttpClient) { }

    async findById(
        id: TranscriptionId
    ): Promise<Result<Transcript, TranscriptionNotFoundError>> {
        try {
            const response = await this.httpClient.get<TranscriptDto>(
                `/transcriptions/${id}`
            );

            if (!response.ok) {
                return Err(
                    new TranscriptionNotFoundError(`Transcription ${id} not found`)
                );
            }

            const dto = response.value.data;
            const transcript = this.mapDtoToEntity(dto);

            return Ok(transcript);
        } catch (error) {
            return Err(
                new TranscriptionNotFoundError(
                    `Failed to fetch transcription ${id}: ${error}`
                )
            );
        }
    }

    async save(transcript: Transcript): Promise<Result<void, Error>> {
        try {
            const dto = this.mapEntityToDto(transcript);
            const response = await this.httpClient.post<void>(
                '/transcriptions',
                dto
            );

            if (!response.ok) {
                return Err(new Error('Failed to save transcription'));
            }

            return Ok(undefined);
        } catch (error) {
            return Err(new Error(`Failed to save transcription: ${error}`));
        }
    }

    async delete(id: TranscriptionId): Promise<Result<void, Error>> {
        try {
            const response = await this.httpClient.delete<void>(
                `/transcriptions/${id}`
            );

            if (!response.ok) {
                return Err(new Error('Failed to delete transcription'));
            }

            return Ok(undefined);
        } catch (error) {
            return Err(
                new Error(`Failed to delete transcription: ${error}`)
            );
        }
    }

    private mapDtoToEntity(dto: TranscriptDto): Transcript {
        const cues = dto.cues.map((cueDto, index) =>
            createCue({
                id: `${dto.transcriptionId}-${index}` as CueId,
                timeRange: TimeRange.create(
                    cueDto.startTimeSeconds,
                    cueDto.endTimeSeconds
                ),
                text: TranscriptText.create(cueDto.text),
                confidence:
                    cueDto.confidence !== null
                        ? ConfidenceScore.create(cueDto.confidence)
                        : undefined,
            })
        );

        const language = dto.language
            ? LanguageCode.create(dto.language)
            : LanguageCode.english();

        return createTranscript({
            id: dto.transcriptionId as TranscriptId,
            cues,
            language,
        });
    }

    private mapEntityToDto(transcript: Transcript): TranscriptDto {
        return {
            transcriptionId: transcript.id,
            audioPath: '',
            cues: transcript.cues.map((cue) => ({
                startTimeSeconds: cue.timeRange.start,
                endTimeSeconds: cue.timeRange.end,
                text: cue.text.value,
                confidence: cue.confidence?.value ?? null,
            })),
            totalCues: transcript.cues.length,
            language: transcript.language.code,
            createdAt: new Date().toISOString(),
        };
    }
}
