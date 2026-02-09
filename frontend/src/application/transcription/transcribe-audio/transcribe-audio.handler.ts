/**
 * Transcribe audio use case - Handler
 */

import { Result } from '../../../domain/shared/result';
import { Transcriber } from '../../../domain/transcription/ports/transcriber';
import { TranscribeAudioCommand } from './transcribe-audio.command';
import { TranscribeAudioDto, CueDto } from './transcribe-audio.dto';

export class TranscribeAudioHandler {
    constructor(private readonly transcriber: Transcriber) { }

    async execute(
        command: TranscribeAudioCommand
    ): Promise<Result<TranscribeAudioDto, Error>> {
        // Transcribe audio
        const transcribeResult = await this.transcriber.transcribe(
            command.audioPath,
            {
                model: command.model,
                language: command.language,
            }
        );

        if (transcribeResult.isFailure()) {
            return Result.fail(transcribeResult.error);
        }

        const transcript = transcribeResult.value;
        const cues = transcript.getCues();

        // Convert cues to DTOs
        const cueDtos: CueDto[] = cues.map((cue) => ({
            startTimeSeconds: cue.getStartTime(),
            endTimeSeconds: cue.getEndTime(),
            text: cue.getText(),
            confidence: cue.getConfidence(),
        }));

        // Create DTO
        const dto: TranscribeAudioDto = {
            transcriptionId: transcript.getId(),
            audioPath: transcript.getAudioPath(),
            cues: cueDtos,
            totalCues: cues.length,
            language: transcript.getLanguage(),
            model: command.model || 'base',
        };

        return Result.ok(dto);
    }
}
