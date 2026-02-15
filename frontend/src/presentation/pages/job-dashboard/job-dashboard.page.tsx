import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { config } from '../../../config';

type LegacyJobSteps = {
    vod: boolean;
    audio: boolean;
    sanitize: boolean;
    srt: boolean;
    train: boolean;
    tts: boolean;
};

type LegacyJobOutputs = {
    audioPath?: string | null;
    sanitizePath?: string | null;
    srtPath?: string | null;
    datasetPath?: string | null;
    ttsPath?: string | null;
};

type LegacyJob = {
    id: string;
    vodUrl: string;
    streamer: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    steps: LegacyJobSteps;
    outputs?: LegacyJobOutputs | null;
};

const STEP_ORDER: Array<keyof LegacyJobSteps> = ['vod', 'audio', 'sanitize', 'srt', 'train', 'tts'];

const formatDate = (value: string): string => {
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) return value;
    return new Date(ts).toLocaleString();
};

const stepCompletion = (steps: LegacyJobSteps): string => {
    const done = STEP_ORDER.filter((key) => Boolean(steps[key])).length;
    return `${done}/${STEP_ORDER.length}`;
};

const nextStepLabel = (steps: LegacyJobSteps): string => {
    if (!steps.audio) return 'Extract';
    if (!steps.sanitize) return 'Sanitize';
    if (!steps.srt) return 'SRT';
    if (!steps.train) return 'Train';
    if (!steps.tts) return 'TTS';
    return 'Completed';
};

export const JobDashboardPage: React.FC = () => {
    const [jobs, setJobs] = useState<LegacyJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/legacy/jobs`);
            const payload = await response.json().catch(() => []);

            if (!response.ok) {
                const detail = (payload as { detail?: string }).detail || response.statusText;
                throw new Error(detail);
            }

            const items = Array.isArray(payload) ? (payload as LegacyJob[]) : [];
            items.sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
            setJobs(items);
        } catch (err) {
            setError((err as Error).message);
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchJobs();
    }, [fetchJobs]);

    const summary = useMemo(() => {
        const total = jobs.length;
        const completed = jobs.filter((job) => STEP_ORDER.every((key) => job.steps[key])).length;
        return { total, completed };
    }, [jobs]);

    return (
        <div className="space-y-6">
            <div className="glass rounded-2xl p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Jobs</h1>
                    <p className="text-sm text-slate-400">Wybierz job i wznow go w Wizardzie bez ponownego wpisywania linku.</p>
                </div>
                <button
                    type="button"
                    onClick={() => void fetchJobs()}
                    disabled={loading}
                    className="secondary-btn px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <div className="glass rounded-2xl p-4 text-sm text-slate-300 flex flex-wrap gap-6">
                <div>Total jobs: <span className="text-white font-semibold">{summary.total}</span></div>
                <div>Completed: <span className="text-white font-semibold">{summary.completed}</span></div>
            </div>

            {error && (
                <div className="glass rounded-xl p-4 border border-red-500/30 text-red-200 text-sm">
                    {error}
                </div>
            )}

            <div className="space-y-3">
                {jobs.length === 0 && !loading ? (
                    <div className="glass rounded-xl p-6 text-sm text-slate-400">
                        Brak jobów do wyświetlenia.
                    </div>
                ) : (
                    jobs.map((job) => (
                        <article key={job.id} className="glass rounded-2xl p-5 space-y-3">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="text-base font-semibold text-white truncate">{job.title || 'Untitled'}</h2>
                                    <p className="text-xs text-slate-400">{job.streamer} · {job.id}</p>
                                </div>
                                <div className="text-xs text-slate-400">Updated: {formatDate(job.updatedAt)}</div>
                            </div>

                            <div className="text-sm text-slate-300 break-all">{job.vodUrl}</div>

                            <div className="flex flex-wrap gap-2 text-xs">
                                {STEP_ORDER.map((key) => (
                                    <span
                                        key={`${job.id}-${key}`}
                                        className={`px-2 py-1 rounded-full border ${job.steps[key] ? 'border-emerald-400/40 text-emerald-200 bg-emerald-400/10' : 'border-slate-500/40 text-slate-300 bg-slate-500/10'}`}
                                    >
                                        {key.toUpperCase()}: {job.steps[key] ? 'OK' : 'PENDING'}
                                    </span>
                                ))}
                            </div>

                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs text-slate-400">
                                    Progress: <span className="text-slate-200">{stepCompletion(job.steps)}</span> · Next: <span className="text-slate-200">{nextStepLabel(job.steps)}</span>
                                </div>
                                <Link
                                    to={`/wizard?jobId=${encodeURIComponent(job.id)}`}
                                    className="primary-btn px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center justify-center"
                                >
                                    Resume in Wizard
                                </Link>
                            </div>
                        </article>
                    ))
                )}
            </div>
        </div>
    );
};
