/**
 * Extract audio use case - Handler
 */

import { Result } from '../../../domain/shared/result';
import { AudioExtractor } from '../../../domain/audio/ports/audio-extractor';
import { ExtractAudioCommand } from './extract-audio.command';
import { ExtractAudioDto } from './extract-audio.dto';

export class ExtractAudioHandler {
    constructor(private readonly audioExtractor: AudioExtractor) { }

    async execute(
        command: ExtractAudioCommand
    ): Promise<Result<ExtractAudioDto, Error>> {
        // Extract audio
        const extractResult = await this.audioExtractor.extract(
            command.videoPath,
            command.outputPath,
            {
                format: command.format,
                sampleRate: command.sampleRate,
            }
        );

        if (extractResult.isFailure()) {
            return Result.fail(extractResult.error);
        }

        const audioFile = extractResult.value;

        // Create DTO
        const dto: ExtractAudioDto = {
            audioPath: audioFile.getPath(),
            format: audioFile.getFormat(),
            sampleRate: audioFile.getSampleRate(),
            durationSeconds: audioFile.getDurationSeconds(),
            fileSizeBytes: audioFile.getFileSizeBytes(),
        };

        return Result.ok(dto);
    }
}
