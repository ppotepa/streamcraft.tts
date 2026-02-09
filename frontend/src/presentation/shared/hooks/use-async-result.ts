/**
 * Hook for working with Result types in React.
 */

import { useCallback, useState } from 'react';
import { Result, isOk, isErr } from '../../../domain/shared/result';

export interface AsyncResultState<T, E> {
    readonly isLoading: boolean;
    readonly isSuccess: boolean;
    readonly isError: boolean;
    readonly data: T | null;
    readonly error: E | null;
}

export interface UseAsyncResultReturn<T, E> extends AsyncResultState<T, E> {
    readonly execute: () => Promise<void>;
    readonly reset: () => void;
}

export const useAsyncResult = <T, E>(
    asyncFn: () => Promise<Result<T, E>>
): UseAsyncResultReturn<T, E> => {
    const [state, setState] = useState<AsyncResultState<T, E>>({
        isLoading: false,
        isSuccess: false,
        isError: false,
        data: null,
        error: null,
    });

    const execute = useCallback(async () => {
        setState((prev) => ({
            ...prev,
            isLoading: true,
            isSuccess: false,
            isError: false,
        }));

        try {
            const result = await asyncFn();

            if (isOk(result)) {
                setState({
                    isLoading: false,
                    isSuccess: true,
                    isError: false,
                    data: result.value,
                    error: null,
                });
            } else {
                setState({
                    isLoading: false,
                    isSuccess: false,
                    isError: true,
                    data: null,
                    error: result.error,
                });
            }
        } catch (error) {
            setState({
                isLoading: false,
                isSuccess: false,
                isError: true,
                data: null,
                error: error as E,
            });
        }
    }, [asyncFn]);

    const reset = useCallback(() => {
        setState({
            isLoading: false,
            isSuccess: false,
            isError: false,
            data: null,
            error: null,
        });
    }, []);

    return {
        ...state,
        execute,
        reset,
    };
};
