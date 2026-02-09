/**
 * Get transcript use case - Handler
 */

import { Result } from '../../../domain/shared/result';
import { TranscriptionNotFoundError } from '../../../domain/transcription/errors/transcription-errors';
import { TranscriptionRepository } from '../../../domain/transcription/ports/transcription-repository';
import { GetTranscriptCommand } from './get-transcript.command';
import { GetTranscriptDto, TranscriptCueDto } from './get-transcript.dto';

export class GetTranscriptHandler {
    constructor(
        private readonly transcriptionRepository: TranscriptionRepository
    ) { }

    async execute(
        command: GetTranscriptCommand
    ): Promise<Result<GetTranscriptDto, TranscriptionNotFoundError>> {
        // Find transcription
        const transcriptResult = await this.transcriptionRepository.findById(
            command.transcriptionId
        );

        if (transcriptResult.isFailure()) {
            return transcriptResult as Result<never, TranscriptionNotFoundError>;
        }

        const transcript = transcriptResult.value;
        const cues = transcript.getCues();

        // Convert cues to DTOs
        const cueDtos: TranscriptCueDto[] = cues.map((cue) => ({
            startTimeSeconds: cue.getStartTime(),
            endTimeSeconds: cue.getEndTime(),
            text: cue.getText(),
            confidence: cue.getConfidence(),
        }));

        // Create DTO
        const dto: GetTranscriptDto = {
            transcriptionId: transcript.getId(),
            audioPath: transcript.getAudioPath(),
            cues: cueDtos,
            totalCues: cues.length,
            language: transcript.getLanguage(),
            createdAt: transcript.getCreatedAt().toISOString(),
        };

        return Result.ok(dto);
    }
}
