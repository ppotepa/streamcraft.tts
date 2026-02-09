/**
 * Fetch-based HTTP client implementation.
 */

import { Err, Ok, Result } from '../../../domain/shared/result';
import { HttpClient, HttpError, HttpResponse, RequestConfig } from './http-client';

export class FetchHttpClient implements HttpClient {
    constructor(private readonly baseUrl: string = '') { }

    async get<T>(
        url: string,
        config?: RequestConfig
    ): Promise<Result<HttpResponse<T>, HttpError>> {
        return this.request<T>(url, { method: 'GET', ...config });
    }

    async post<T>(
        url: string,
        data?: unknown,
        config?: RequestConfig
    ): Promise<Result<HttpResponse<T>, HttpError>> {
        return this.request<T>(url, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
            ...config,
        });
    }

    async put<T>(
        url: string,
        data?: unknown,
        config?: RequestConfig
    ): Promise<Result<HttpResponse<T>, HttpError>> {
        return this.request<T>(url, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
            ...config,
        });
    }

    async delete<T>(
        url: string,
        config?: RequestConfig
    ): Promise<Result<HttpResponse<T>, HttpError>> {
        return this.request<T>(url, { method: 'DELETE', ...config });
    }

    private async request<T>(
        url: string,
        config: RequestConfig & { method: string; body?: string }
    ): Promise<Result<HttpResponse<T>, HttpError>> {
        try {
            const fullUrl = `${this.baseUrl}${url}`;
            const headers = {
                'Content-Type': 'application/json',
                ...config.headers,
            };

            const response = await fetch(fullUrl, {
                method: config.method,
                headers,
                body: config.body,
                signal: config.signal,
            });

            const data = await response.json();

            if (!response.ok) {
                return Err({
                    message: `HTTP ${response.status}: ${response.statusText}`,
                    status: response.status,
                    data,
                });
            }

            return Ok({
                data: data as T,
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
            });
        } catch (error) {
            return Err({
                message: error instanceof Error ? error.message : 'Unknown error',
                data: error,
            });
        }
    }
}
