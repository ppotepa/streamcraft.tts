/**
 * HTTP Dataset Repository Adapter
 */

import { Result, Ok, Err } from '../../../domain/shared';
import type { Dataset } from '../../../domain/dataset/entities/dataset.entity';
import { createDataset } from '../../../domain/dataset/entities/dataset.entity';
import { createDatasetEntry } from '../../../domain/dataset/entities/dataset-entry.entity';
import { DatasetFormat } from '../../../domain/dataset/value-objects/dataset-format';
import { EntryPath } from '../../../domain/dataset/value-objects/entry-path';
import { DatasetId, EntryId, SegmentId } from '../../../domain/shared/branded-types';
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

            if (!response.ok) {
                return Err(
                    new DatasetNotFoundError(`Dataset ${id} not found`)
                );
            }

            const dto = response.value.data;
            const dataset = this.mapDtoToEntity(dto);

            return Ok(dataset);
        } catch (error) {
            return Err(
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

            if (!response.ok) {
                return Err(new Error('Failed to fetch datasets'));
            }

            const datasets = response.value.data.datasets.map((dto) =>
                this.mapDtoToEntity(dto)
            );

            return Ok(datasets);
        } catch (error) {
            return Err(new Error(`Failed to fetch datasets: ${error}`));
        }
    }

    async save(dataset: Dataset): Promise<Result<void, Error>> {
        try {
            const dto = this.mapEntityToDto(dataset);
            const response = await this.httpClient.post<void>('/datasets', dto);

            if (!response.ok) {
                return Err(new Error('Failed to save dataset'));
            }

            return Ok(undefined);
        } catch (error) {
            return Err(new Error(`Failed to save dataset: ${error}`));
        }
    }

    async delete(id: DatasetId): Promise<Result<void, Error>> {
        try {
            const response = await this.httpClient.delete<void>(`/datasets/${id}`);

            if (!response.ok) {
                return Err(new Error('Failed to delete dataset'));
            }

            return Ok(undefined);
        } catch (error) {
            return Err(new Error(`Failed to delete dataset: ${error}`));
        }
    }

    private mapDtoToEntity(dto: DatasetDto): Dataset {
        const entries = dto.entries.map((entryDto, index) =>
            createDatasetEntry({
                id: `${dto.datasetId}-entry-${index}` as EntryId,
                segmentId: `${dto.datasetId}-seg-${index}` as SegmentId,
                audioPath: EntryPath.create(entryDto.audioPath),
                text: entryDto.text,
                durationSeconds: entryDto.durationSeconds ?? 0,
            })
        );

        return createDataset({
            id: dto.datasetId as DatasetId,
            name: dto.name,
            entries,
            format: DatasetFormat.JSON,
        });
    }

    private mapEntityToDto(dataset: Dataset): DatasetDto {
        return {
            datasetId: dataset.id,
            name: dataset.name,
            entries: dataset.entries.map((entry) => ({
                audioPath: entry.audioPath.path,
                text: entry.text,
                durationSeconds: entry.durationSeconds,
            })),
            totalEntries: dataset.entries.length,
            createdAt: new Date().toISOString(),
        };
    }
}
