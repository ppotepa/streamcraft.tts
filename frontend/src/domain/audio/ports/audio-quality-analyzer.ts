/**
 * Audio quality analyzer port.
 */

import { Result } from '../../shared/result';
import { RmsDb } from '../value-objects/rms-db';

export interface AudioQualityAnalyzer {
    analyzeRms(audioPath: string): Promise<Result<RmsDb, Error>>;
    calculateQualityScore(audioPath: string): Promise<Result<number, Error>>;
}
