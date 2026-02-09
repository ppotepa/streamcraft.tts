/**
 * HTTP Transcription Repository Adapter
 */

import { Result } from '../../../domain/shared/result';
import { Transcript } from '../../../domain/transcription/entities/transcript.entity';
import { Cue } from '../../../domain/transcription/entities/cue.entity';
import { TranscriptionId } from '../../../domain/transcription/value-objects/transcription-id';
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

            if (response.isFailure()) {
                return Result.fail(
                    new TranscriptionNotFoundError(`Transcription ${id} not found`)
                );
            }

            const dto = response.value;
            const transcript = this.mapDtoToEntity(dto);

            return Result.ok(transcript);
        } catch (error) {
            return Result.fail(
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

            if (response.isFailure()) {
                return Result.fail(new Error('Failed to save transcription'));
            }

            return Result.ok(undefined);
        } catch (error) {
            return Result.fail(new Error(`Failed to save transcription: ${error}`));
        }
    }

    async delete(id: TranscriptionId): Promise<Result<void, Error>> {
        try {
            const response = await this.httpClient.delete<void>(
                `/transcriptions/${id}`
            );

            if (response.isFailure()) {
                return Result.fail(new Error('Failed to delete transcription'));
            }

            return Result.ok(undefined);
        } catch (error) {
            return Result.fail(
                new Error(`Failed to delete transcription: ${error}`)
            );
        }
    }

    private mapDtoToEntity(dto: TranscriptDto): Transcript {
        const cues = dto.cues.map(
            (cueDto) =>
                new Cue(
                    cueDto.startTimeSeconds,
                    cueDto.endTimeSeconds,
                    cueDto.text,
                    cueDto.confidence
                )
        );

        return new Transcript(
            dto.transcriptionId,
            dto.audioPath,
            cues,
            dto.language,
            new Date(dto.createdAt)
        );
    }

    private mapEntityToDto(transcript: Transcript): TranscriptDto {
        const cues = transcript.getCues();

        return {
            transcriptionId: transcript.getId(),
            audioPath: transcript.getAudioPath(),
            cues: cues.map((cue) => ({
                startTimeSeconds: cue.getStartTime(),
                endTimeSeconds: cue.getEndTime(),
                text: cue.getText(),
                confidence: cue.getConfidence(),
            })),
            totalCues: cues.length,
            language: transcript.getLanguage(),
            createdAt: transcript.getCreatedAt().toISOString(),
        };
    }
}
