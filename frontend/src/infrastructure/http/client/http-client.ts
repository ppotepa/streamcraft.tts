/**
 * HTTP client abstraction.
 */

import { Result } from '../../../domain/shared/result';

export interface HttpResponse<T> {
    readonly data: T;
    readonly status: number;
    readonly headers: Record<string, string>;
}

export interface HttpError {
    readonly message: string;
    readonly status?: number;
    readonly data?: unknown;
}

export interface HttpClient {
    get<T>(url: string, config?: RequestConfig): Promise<Result<HttpResponse<T>, HttpError>>;

    post<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<HttpResponse<T>, HttpError>>;

    put<T>(url: string, data?: unknown, config?: RequestConfig): Promise<Result<HttpResponse<T>, HttpError>>;

    delete<T>(url: string, config?: RequestConfig): Promise<Result<HttpResponse<T>, HttpError>>;
}

export interface RequestConfig {
    readonly headers?: Record<string, string>;
    readonly timeout?: number;
    readonly signal?: AbortSignal;
}
