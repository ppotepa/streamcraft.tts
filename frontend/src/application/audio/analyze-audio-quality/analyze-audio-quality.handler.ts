/**
 * Analyze audio quality use case - Handler
 */

import { Result } from '../../../domain/shared/result';
import { AudioQualityAnalyzer } from '../../../domain/audio/ports/audio-quality-analyzer';
import { AnalyzeAudioQualityCommand } from './analyze-audio-quality.command';
import { AnalyzeAudioQualityDto } from './analyze-audio-quality.dto';

export class AnalyzeAudioQualityHandler {
    constructor(private readonly qualityAnalyzer: AudioQualityAnalyzer) { }

    async execute(
        command: AnalyzeAudioQualityCommand
    ): Promise<Result<AnalyzeAudioQualityDto, Error>> {
        // Analyze RMS
        const rmsResult = await this.qualityAnalyzer.analyzeRms(command.audioPath);
        if (rmsResult.isFailure()) {
            return Result.fail(rmsResult.error);
        }

        // Calculate quality score
        const qualityResult = await this.qualityAnalyzer.calculateQualityScore(
            command.audioPath
        );
        if (qualityResult.isFailure()) {
            return Result.fail(qualityResult.error);
        }

        const rmsDb = rmsResult.value;
        const qualityScore = qualityResult.value;

        // Determine if silence or clipping based on thresholds
        const isSilence = rmsDb < -60; // Below -60dB is likely silence
        const isClipping = rmsDb > -3; // Above -3dB is likely clipping

        // Create DTO
        const dto: AnalyzeAudioQualityDto = {
            audioPath: command.audioPath,
            rmsDb,
            qualityScore,
            isSilence,
            isClipping,
        };

        return Result.ok(dto);
    }
}
