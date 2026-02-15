import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { config } from '../../../config';

type StreamerSummary = {
    streamer: string;
    datasets: number;
    runs: number;
    latestRunAt?: string | null;
    latestTtsPath?: string | null;
};

type DatasetRecord = {
    datasetId: string;
    streamer: string;
    runId?: string | null;
    status: string;
    createdAt?: string | null;
    vodUrl?: string | null;
    vodId?: string | null;
    datasetPath: string;
    clipsPath?: string | null;
    clipsCount: number;
    manifestPath?: string | null;
    segmentsPath?: string | null;
    latestTtsPath?: string | null;
    hasTrainArtifacts: boolean;
    hasTtsArtifacts: boolean;
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
};

const artifactUrl = (path: string) => `${config.apiBaseUrl}/legacy/artifact?path=${encodeURIComponent(path)}`;

export const DatasetsBrowserPage: React.FC = () => {
    const [streamers, setStreamers] = useState<StreamerSummary[]>([]);
    const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
    const [selectedStreamer, setSelectedStreamer] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (refresh = false, streamer: string | null = selectedStreamer) => {
        setLoading(true);
        setError(null);
        try {
            const refreshQuery = refresh ? '&refresh=true' : '';
            const streamersResponse = await fetch(`${config.apiBaseUrl}/legacy/datasets/streamers?datasetOut=dataset&outdir=out${refreshQuery}`);
            const streamersPayload = await streamersResponse.json();
            if (!streamersResponse.ok) {
                throw new Error(streamersPayload?.detail || 'Failed to load streamers');
            }

            const streamerQuery = streamer ? `&streamer=${encodeURIComponent(streamer)}` : '';
            const datasetsResponse = await fetch(`${config.apiBaseUrl}/legacy/datasets?datasetOut=dataset&outdir=out${streamerQuery}${refreshQuery}`);
            const datasetsPayload = await datasetsResponse.json();
            if (!datasetsResponse.ok) {
                throw new Error(datasetsPayload?.detail || 'Failed to load datasets');
            }

            setStreamers(streamersPayload.items || []);
            setDatasets(datasetsPayload.items || []);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [selectedStreamer]);

    useEffect(() => {
        void fetchData(false, selectedStreamer);
    }, [selectedStreamer, fetchData]);

    const selectedStreamerSummary = useMemo(
        () => streamers.find((item) => item.streamer === selectedStreamer) ?? null,
        [streamers, selectedStreamer]
    );

    return (
        <div className="space-y-6">
            <div className="glass rounded-2xl p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Datasets Browser</h1>
                    <p className="text-sm text-slate-400">Przegląd datasetów i artefaktów TTS per streamer.</p>
                </div>
                <button
                    type="button"
                    onClick={() => void fetchData(true)}
                    className="secondary-btn px-4 py-2 rounded-lg text-sm font-semibold"
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh Index'}
                </button>
            </div>

            <div className="glass rounded-2xl p-4">
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => setSelectedStreamer(null)}
                        className={`px-3 py-2 rounded-lg text-sm border ${selectedStreamer === null ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}
                    >
                        All streamers ({streamers.length})
                    </button>
                    {streamers.map((item) => (
                        <button
                            key={item.streamer}
                            type="button"
                            onClick={() => setSelectedStreamer(item.streamer)}
                            className={`px-3 py-2 rounded-lg text-sm border ${selectedStreamer === item.streamer ? 'border-cyan-300/60 bg-cyan-300/15 text-cyan-100' : 'border-white/10 text-slate-300 hover:bg-white/5'}`}
                            title={`runs: ${item.runs}, datasets: ${item.datasets}`}
                        >
                            {item.streamer} ({item.datasets})
                        </button>
                    ))}
                </div>
            </div>

            {selectedStreamerSummary && (
                <div className="glass rounded-2xl p-4 text-sm text-slate-300 grid gap-2 md:grid-cols-4">
                    <div>Streamer: <span className="text-white font-medium">{selectedStreamerSummary.streamer}</span></div>
                    <div>Datasets: <span className="text-white font-medium">{selectedStreamerSummary.datasets}</span></div>
                    <div>Runs: <span className="text-white font-medium">{selectedStreamerSummary.runs}</span></div>
                    <div>Latest run: <span className="text-white font-medium">{formatDate(selectedStreamerSummary.latestRunAt)}</span></div>
                </div>
            )}

            <div className="glass rounded-2xl p-4 overflow-x-auto">
                {error ? (
                    <div className="text-red-300 text-sm">{error}</div>
                ) : (
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="text-slate-400 border-b border-white/10">
                                <th className="text-left py-2 pr-4">Streamer</th>
                                <th className="text-left py-2 pr-4">Run</th>
                                <th className="text-left py-2 pr-4">Status</th>
                                <th className="text-left py-2 pr-4">Clips</th>
                                <th className="text-left py-2 pr-4">Created</th>
                                <th className="text-left py-2 pr-4">Artifacts</th>
                                <th className="text-left py-2 pr-4">Review</th>
                            </tr>
                        </thead>
                        <tbody>
                            {datasets.map((item) => (
                                <tr key={item.datasetId} className="border-b border-white/5 text-slate-200 align-top">
                                    <td className="py-2 pr-4">{item.streamer}</td>
                                    <td className="py-2 pr-4">{item.runId || 'legacy'}</td>
                                    <td className="py-2 pr-4">{item.status}</td>
                                    <td className="py-2 pr-4">{item.clipsCount}</td>
                                    <td className="py-2 pr-4">{formatDate(item.createdAt)}</td>
                                    <td className="py-2 pr-4">
                                        <div className="flex flex-wrap gap-2">
                                            {item.datasetPath && (
                                                <a className="text-cyan-300 hover:text-cyan-200" href={artifactUrl(item.datasetPath)} target="_blank" rel="noreferrer">
                                                    dataset
                                                </a>
                                            )}
                                            {item.manifestPath && (
                                                <a className="text-cyan-300 hover:text-cyan-200" href={artifactUrl(item.manifestPath)} target="_blank" rel="noreferrer">
                                                    manifest
                                                </a>
                                            )}
                                            {item.segmentsPath && (
                                                <a className="text-cyan-300 hover:text-cyan-200" href={artifactUrl(item.segmentsPath)} target="_blank" rel="noreferrer">
                                                    segments
                                                </a>
                                            )}
                                            {item.latestTtsPath && (
                                                <a className="text-emerald-300 hover:text-emerald-200" href={artifactUrl(item.latestTtsPath)} target="_blank" rel="noreferrer">
                                                    latest tts
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="py-2 pr-4">
                                        {item.vodUrl && item.runId ? (
                                            <a
                                                className="text-amber-300 hover:text-amber-200"
                                                href={`/review?vodUrl=${encodeURIComponent(item.vodUrl)}&runId=${encodeURIComponent(item.runId)}`}
                                            >
                                                open review manager
                                            </a>
                                        ) : (
                                            <span className="text-slate-500">run-scoped only</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {datasets.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={7} className="py-6 text-slate-500 text-center">
                                        Brak datasetów do wyświetlenia.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
