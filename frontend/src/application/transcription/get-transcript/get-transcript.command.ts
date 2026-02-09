/**
 * Get transcript use case - Command
 */

import { TranscriptionId } from '../../../domain/transcription/value-objects/transcription-id';

export interface GetTranscriptCommand {
    readonly transcriptionId: TranscriptionId;
}
