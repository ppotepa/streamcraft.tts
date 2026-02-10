/**
 * Application layer use case base.
 */

import type { Result } from '../../domain/shared/result';

export abstract class UseCase<TInput, TOutput, TError> {
    abstract execute(request: TInput): Promise<Result<TOutput, TError>>;
}
