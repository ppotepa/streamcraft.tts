/**
 * Result type for explicit error handling without exceptions.
 *
 * Result<T, E> represents either success with value T or failure with error E.
 * This makes error handling explicit and forces consumers to handle both cases.
 */

export type Result<T, E> = Success<T, E> | Failure<T, E>;

export interface Success<T, E> {
    readonly ok: true;
    readonly value: T;
}

export interface Failure<T, E> {
    readonly ok: false;
    readonly error: E;
}

// Constructors
export const Ok = <T, E = never>(value: T): Success<T, E> => ({
    ok: true,
    value,
});

export const Err = <T = never, E = unknown>(error: E): Failure<T, E> => ({
    ok: false,
    error,
});

// Type guards
export const isOk = <T, E>(result: Result<T, E>): result is Success<T, E> => {
    return result.ok === true;
};

export const isErr = <T, E>(result: Result<T, E>): result is Failure<T, E> => {
    return result.ok === false;
};

// Utilities
export const map = <T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => U
): Result<U, E> => {
    return result.ok ? Ok(fn(result.value)) : Err(result.error);
};

export const mapError = <T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => F
): Result<T, F> => {
    return result.ok ? Ok(result.value) : Err(fn(result.error));
};

export const andThen = <T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
): Result<U, E> => {
    return result.ok ? fn(result.value) : Err(result.error);
};

export const unwrap = <T, E>(result: Result<T, E>): T => {
    if (!result.ok) {
        throw new Error(`Called unwrap on Err: ${JSON.stringify(result.error)}`);
    }
    return result.value;
};

export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T => {
    return result.ok ? result.value : defaultValue;
};

export const unwrapOrElse = <T, E>(
    result: Result<T, E>,
    fn: (error: E) => T
): T => {
    return result.ok ? result.value : fn(result.error);
};

// Match for exhaustive handling
export const match = <T, E, U>(
    result: Result<T, E>,
    matcher: {
        readonly ok: (value: T) => U;
        readonly err: (error: E) => U;
    }
): U => {
    return result.ok ? matcher.ok(result.value) : matcher.err(result.error);
};
