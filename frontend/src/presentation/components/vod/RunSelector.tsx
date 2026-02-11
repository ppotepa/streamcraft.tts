/**
 * RunSelector component - dropdown for selecting and managing VOD runs
 */

import React, { useEffect, useState } from 'react';
import { VodRun } from '../../../domain/vod/run.types';
import { listVodRuns, deleteVodRun } from '../../../infrastructure/api/runService';

export interface RunSelectorProps {
    vodUrl: string;
    datasetOut?: string;
    currentRunId?: string;
    onRunSelect: (run: VodRun) => void;
    onNewRun?: () => void;
}

export const RunSelector: React.FC<RunSelectorProps> = ({
    vodUrl,
    datasetOut = 'dataset',
    currentRunId,
    onRunSelect,
    onNewRun,
}) => {
    const [runs, setRuns] = useState<VodRun[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        loadRuns();
    }, [vodUrl, datasetOut]);

    const loadRuns = async () => {
        if (!vodUrl) return;

        setLoading(true);
        setError(null);

        try {
            const fetchedRuns = await listVodRuns(vodUrl, datasetOut);
            setRuns(fetchedRuns);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load runs');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (runId: string, event: React.MouseEvent) => {
        event.stopPropagation();

        if (runId === 'default') {
            alert('Cannot delete legacy default run');
            return;
        }

        if (!confirm(`Delete run ${runId}? This cannot be undone.`)) {
            return;
        }

        try {
            await deleteVodRun(runId, vodUrl, datasetOut);
            await loadRuns();
        } catch (err) {
            alert(`Failed to delete run: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    };

    const formatDate = (isoDate: string): string => {
        const date = new Date(isoDate);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
    };

    const getStatusIcon = (status: string): string => {
        switch (status) {
            case 'completed':
                return '✓';
            case 'in_progress':
                return '⏳';
            case 'failed':
                return '✗';
            case 'canceled':
                return '⊘';
            default:
                return '?';
        }
    };

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'completed':
                return 'text-green-400';
            case 'in_progress':
                return 'text-yellow-400';
            case 'failed':
                return 'text-red-400';
            case 'canceled':
                return 'text-gray-400';
            default:
                return 'text-gray-500';
        }
    };

    const currentRun = runs.find((r) => r.run_id === currentRunId);

    return (
        <div className="relative">
            {/* Selector button */}
            <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="glass rounded-lg px-4 py-2 text-sm font-medium text-white flex items-center gap-2 hover:bg-white/10 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                </svg>
                <span>
                    {loading
                        ? 'Loading...'
                        : currentRun
                            ? `Run: ${currentRun.run_id === 'default' ? 'Legacy' : currentRun.run_id.slice(0, 8)}`
                            : 'Select Run'}
                </span>
                <svg
                    className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Dropdown menu */}
            {showMenu && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />

                    {/* Menu */}
                    <div className="absolute top-full left-0 mt-2 w-96 glass rounded-lg shadow-2xl z-20 max-h-96 overflow-y-auto">
                        {/* Header */}
                        <div className="p-3 border-b border-white/10 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white">Saved Runs</h3>
                            {onNewRun && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowMenu(false);
                                        onNewRun();
                                    }}
                                    className="text-xs px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                                >
                                    + New Run
                                </button>
                            )}
                        </div>

                        {/* Error state */}
                        {error && (
                            <div className="p-3 text-sm text-red-400">
                                {error}
                                <button
                                    type="button"
                                    onClick={loadRuns}
                                    className="ml-2 text-xs underline hover:no-underline"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {/* Loading state */}
                        {loading && (
                            <div className="p-4 text-center text-sm text-gray-400">Loading runs...</div>
                        )}

                        {/* Empty state */}
                        {!loading && !error && runs.length === 0 && (
                            <div className="p-4 text-center text-sm text-gray-400">
                                No runs found. Run sanitization to create a new run.
                            </div>
                        )}

                        {/* Runs list */}
                        {!loading && runs.length > 0 && (
                            <div className="divide-y divide-white/10">
                                {runs.map((run) => (
                                    <div
                                        key={run.run_id}
                                        className={`p-3 hover:bg-white/5 cursor-pointer transition-colors ${run.run_id === currentRunId ? 'bg-blue-600/20' : ''
                                            }`}
                                        onClick={() => {
                                            onRunSelect(run);
                                            setShowMenu(false);
                                        }}
                                    >
                                        {/* Run header */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-lg ${getStatusColor(run.status)}`}>
                                                        {getStatusIcon(run.status)}
                                                    </span>
                                                    <span className="text-sm font-medium text-white truncate">
                                                        {run.run_id === 'default' ? 'Legacy Run' : run.run_id}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    {formatDate(run.created_at)}
                                                </div>
                                            </div>

                                            {/* Delete button */}
                                            {run.run_id !== 'default' && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDelete(run.run_id, e)}
                                                    className="ml-2 p-1 text-gray-400 hover:text-red-400 transition-colors"
                                                    title="Delete run"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                        />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>

                                        {/* Run details */}
                                        <div className="flex items-center gap-3 text-xs text-gray-400">
                                            <span className="px-2 py-0.5 rounded-full bg-white/10">
                                                {run.params.preset}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-white/10">
                                                {run.params.mode}
                                            </span>
                                            {run.params.extract_vocals && (
                                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                                                    UVR
                                                </span>
                                            )}
                                        </div>

                                        {/* Stats */}
                                        {run.stats && (
                                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-400">Segments:</span>
                                                    <span className="text-white font-medium">
                                                        {run.stats.kept_segments}/{run.stats.total_segments}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-400">Duration:</span>
                                                    <span className="text-white font-medium">
                                                        {formatDuration(run.stats.clean_duration)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
