/**
 * API service for VOD run management
 */

import { config } from '../../config';
import { VodRun, RunListResponse } from '../../domain/vod/run.types';

const apiBaseUrl = config.apiBaseUrl;

/**
 * List all runs for a VOD
 */
export async function listVodRuns(vodUrl: string, datasetOut: string = 'dataset'): Promise<VodRun[]> {
    const params = new URLSearchParams({
        vod_url: vodUrl,
        dataset_out: datasetOut,
    });

    const response = await fetch(`${apiBaseUrl}/vods/runs?${params}`);
    if (!response.ok) {
        throw new Error(`Failed to list runs: ${response.statusText}`);
    }

    const data: RunListResponse = await response.json();
    return data.runs;
}

/**
 * Get metadata for a specific run
 */
export async function getVodRun(
    runId: string,
    vodUrl: string,
    datasetOut: string = 'dataset'
): Promise<VodRun> {
    const params = new URLSearchParams({
        vod_url: vodUrl,
        dataset_out: datasetOut,
    });

    const response = await fetch(`${apiBaseUrl}/vods/runs/${runId}?${params}`);
    if (!response.ok) {
        throw new Error(`Failed to get run: ${response.statusText}`);
    }

    return await response.json();
}

/**
 * Delete a specific run
 */
export async function deleteVodRun(
    runId: string,
    vodUrl: string,
    datasetOut: string = 'dataset'
): Promise<void> {
    const params = new URLSearchParams({
        vod_url: vodUrl,
        dataset_out: datasetOut,
    });

    const response = await fetch(`${apiBaseUrl}/vods/runs/${runId}?${params}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(`Failed to delete run: ${response.statusText}`);
    }
}
