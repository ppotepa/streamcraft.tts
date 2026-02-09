/**
 * HTTP-based Dataset Writer implementation
 * Communicates with backend API to export datasets
 */

import { Result, ok, err } from '../../../domain/shared/result';
import { DatasetWriter } from '../../../domain/dataset/ports/dataset-writer';
import { Dataset } from '../../../domain/dataset/entities/dataset';
import { HttpClient } from '../client/http-client';

export class HttpDatasetWriter implements DatasetWriter {
    constructor(private httpClient: HttpClient) { }

    async write(
        dataset: Dataset,
        outputPath: string,
        format: string
    ): Promise<Result<{ path: string; size: number }, Error>> {
        try {
            const response = await this.httpClient.post<{
                output_path: string;
                format: string;
                file_size_bytes: number;
            }>(`/datasets/${dataset.datasetId}/export`, {
                dataset_id: dataset.datasetId,
                output_path: outputPath,
                format,
            });

            if (response.isErr()) {
                return err(response.error);
            }

            const data = response.value;
            return ok({
                path: data.output_path,
                size: data.file_size_bytes,
            });
        } catch (error) {
            return err(
                error instanceof Error ? error : new Error('Failed to export dataset')
            );
        }
    }
}
