/**
 * HTTP Dataset Repository Adapter
 */

import { Result } from '../../../domain/shared/result';
import { Dataset } from '../../../domain/dataset/entities/dataset.entity';
import { DatasetEntry } from '../../../domain/dataset/entities/dataset-entry.entity';
import { DatasetId } from '../../../domain/dataset/value-objects/dataset-id';
import { DatasetRepository } from '../../../domain/dataset/ports/dataset-repository';
import { DatasetNotFoundError } from '../../../domain/dataset/errors/dataset-errors';
import { HttpClient } from '../client/http-client';

interface DatasetEntryDto {
    audioPath: string;
    text: string;
    durationSeconds?: number;
}

interface DatasetDto {
    datasetId: string;
    name: string;
    entries: DatasetEntryDto[];
    totalEntries: number;
    createdAt: string;
}

export class HttpDatasetRepository implements DatasetRepository {
    constructor(private readonly httpClient: HttpClient) { }

    async findById(
        id: DatasetId
    ): Promise<Result<Dataset, DatasetNotFoundError>> {
        try {
            const response = await this.httpClient.get<DatasetDto>(
                `/datasets/${id}`
            );

            if (response.isFailure()) {
                return Result.fail(
                    new DatasetNotFoundError(`Dataset ${id} not found`)
                );
            }

            const dto = response.value;
            const dataset = this.mapDtoToEntity(dto);

            return Result.ok(dataset);
        } catch (error) {
            return Result.fail(
                new DatasetNotFoundError(`Failed to fetch dataset ${id}: ${error}`)
            );
        }
    }

    async findAll(): Promise<Result<readonly Dataset[], Error>> {
        try {
            const response = await this.httpClient.get<{
                datasets: DatasetDto[];
                totalCount: number;
            }>('/datasets');

            if (response.isFailure()) {
                return Result.fail(new Error('Failed to fetch datasets'));
            }

            const datasets = response.value.datasets.map((dto) =>
                this.mapDtoToEntity(dto)
            );

            return Result.ok(datasets);
        } catch (error) {
            return Result.fail(new Error(`Failed to fetch datasets: ${error}`));
        }
    }

    async save(dataset: Dataset): Promise<Result<void, Error>> {
        try {
            const dto = this.mapEntityToDto(dataset);
            const response = await this.httpClient.post<void>('/datasets', dto);

            if (response.isFailure()) {
                return Result.fail(new Error('Failed to save dataset'));
            }

            return Result.ok(undefined);
        } catch (error) {
            return Result.fail(new Error(`Failed to save dataset: ${error}`));
        }
    }

    async delete(id: DatasetId): Promise<Result<void, Error>> {
        try {
            const response = await this.httpClient.delete<void>(`/datasets/${id}`);

            if (response.isFailure()) {
                return Result.fail(new Error('Failed to delete dataset'));
            }

            return Result.ok(undefined);
        } catch (error) {
            return Result.fail(new Error(`Failed to delete dataset: ${error}`));
        }
    }

    private mapDtoToEntity(dto: DatasetDto): Dataset {
        const entries = dto.entries.map(
            (entryDto) =>
                new DatasetEntry(
                    entryDto.audioPath,
                    entryDto.text,
                    entryDto.durationSeconds
                )
        );

        return new Dataset(
            dto.datasetId,
            dto.name,
            entries,
            new Date(dto.createdAt)
        );
    }

    private mapEntityToDto(dataset: Dataset): DatasetDto {
        const entries = dataset.getEntries();

        return {
            datasetId: dataset.getId(),
            name: dataset.getName(),
            entries: entries.map((entry) => ({
                audioPath: entry.getAudioPath(),
                text: entry.getText(),
                durationSeconds: entry.getDurationSeconds(),
            })),
            totalEntries: entries.length,
            createdAt: dataset.getCreatedAt().toISOString(),
        };
    }
}
