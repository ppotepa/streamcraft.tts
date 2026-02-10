/**
 * Wizard Page
 * Simple guided flow for VOD -> Extract -> Sanitize -> Transcribe -> Train -> TTS
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ManualReviewPage } from '../manual-review/manual-review.page';
import { VodSearch, VodMetadataCard } from '../../features/vod-management';
import { useDependencies } from '../../context/dependency-context';
import { useFetchVodMetadata } from '../../shared/hooks/use-fetch-vod-metadata';
import { parseVodUrl } from '../../../domain/vod/utils/parse-vod-url';
import { config } from '../../../config';

type StepStatus = 'blocked' | 'ready' | 'running' | 'done' | 'error' | 'idle';

type RunState = {
    status: StepStatus;
    message?: string;
    log?: string[];
    outputPath?: string;
};

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

type RunKey = 'extract' | 'sanitize' | 'srt' | 'train' | 'tts';

const MAX_LOG_LINES = 600;

const statusClass = (status: StepStatus): string => {
    if (status === 'done') return 'bg-green-100 text-green-700';
    if (status === 'running') return 'bg-amber-100 text-amber-700';
    if (status === 'error') return 'bg-red-100 text-red-700';
    if (status === 'ready') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-500';
};

const progressForStatus = (status: StepStatus): number => {
    if (status === 'done') return 100;
    if (status === 'running') return 65;
    if (status === 'ready') return 0;
    if (status === 'error') return 0;
    if (status === 'idle') return 0;
    return 0;
};

const progressClass = (status: StepStatus): string => {
    if (status === 'done') return 'progress-bar done';
    if (status === 'error') return 'progress-bar error';
    if (status === 'running') return 'progress-bar running';
    return 'progress-bar';
};

const progressValueForStep = (status: StepStatus, override?: number | null): number => {
    if (override !== null && override !== undefined && Number.isFinite(override)) {
        return Math.max(0, Math.min(100, override));
    }
    return progressForStatus(status);
};

const stepProgressFraction = (status: StepStatus, override?: number | null): number => {
    if (status === 'done') return 1;
    if (status === 'running') return progressValueForStep(status, override) / 100;
    if (status === 'error') return (override ?? 0) / 100;
    return 0;
};

const overallProgressForSteps = (steps: Array<{ status: StepStatus; progress?: number | null }>): number => {
    if (!steps.length) return 0;
    const total = steps.length;
    const completed = steps.reduce((sum, step) => sum + stepProgressFraction(step.status, step.progress), 0);
    return Math.min(100, Math.round((completed / total) * 100));
};

export const WizardPage: React.FC = () => {
    const container = useDependencies();
    const fetchMetadataHandler = container.getFetchVodMetadataHandler();

    const {
        data: metadata,
        isLoading: isFetching,
        error: fetchError,
        execute: fetchMetadata,
        reset: resetMetadata,
    } = useFetchVodMetadata(fetchMetadataHandler);

    const [vodUrl, setVodUrl] = useState('');
    const [vodInput, setVodInput] = useState('');
    const [vodInvalid, setVodInvalid] = useState(false);
    const debounceRef = useRef<number | null>(null);
    const [vodQuality, setVodQuality] = useState('audio_only');
    const [authToken, setAuthToken] = useState('');
    const [sanitizeMode, setSanitizeMode] = useState<'auto' | 'voice'>('auto');
    const [sanitizePreset, setSanitizePreset] = useState<'strict' | 'balanced' | 'lenient' | 'rapid' | 'performance'>('balanced');
    const [sanitizeStrictness, setSanitizeStrictness] = useState(0.5);
    const [sanitizeExtractVocals, setSanitizeExtractVocals] = useState(false);
    const [ttsText, setTtsText] = useState('Sample line for TTS.');

    const [extractState, setExtractState] = useState<RunState>({ status: 'idle' });
    const [sanitizeState, setSanitizeState] = useState<RunState>({ status: 'idle' });
    const [srtState, setSrtState] = useState<RunState>({ status: 'idle' });
    const [trainState, setTrainState] = useState<RunState>({ status: 'idle' });
    const [ttsState, setTtsState] = useState<RunState>({ status: 'idle' });
    const [sanitizeProgress, setSanitizeProgress] = useState<number | null>(null);
    const [extractProgress, setExtractProgress] = useState<number | null>(null);
    const [suggestionRunning, setSuggestionRunning] = useState(false);

    // Review preferences with localStorage persistence
    const [reviewPerfMode, setReviewPerfMode] = useState(() => {
        const stored = localStorage.getItem('reviewPerfMode');
        return stored !== null ? stored === 'true' : false;
    });
    const [reviewShowTimeline, setReviewShowTimeline] = useState(() => {
        const stored = localStorage.getItem('reviewShowTimeline');
        return stored !== null ? stored === 'true' : true;
    });
    const [reviewShowTrays, setReviewShowTrays] = useState(() => {
        const stored = localStorage.getItem('reviewShowTrays');
        return stored !== null ? stored === 'true' : true;
    });

    const [audioPath, setAudioPath] = useState<string | null>(null);
    const [cleanPath, setCleanPath] = useState<string | null>(null);
    const [srtPath, setSrtPath] = useState<string | null>(null);
    const [datasetPath, setDatasetPath] = useState<string | null>(null);
    const [ttsPath, setTtsPath] = useState<string | null>(null);
    const [waveformReady, setWaveformReady] = useState(false);
    const [cleanWaveformReady, setCleanWaveformReady] = useState(false);
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [comparePosition, setComparePosition] = useState(55);
    const [reviewOpen, setReviewOpen] = useState(false);

    // Persist review preferences to localStorage
    useEffect(() => {
        localStorage.setItem('reviewPerfMode', String(reviewPerfMode));
    }, [reviewPerfMode]);

    useEffect(() => {
        localStorage.setItem('reviewShowTimeline', String(reviewShowTimeline));
    }, [reviewShowTimeline]);

    useEffect(() => {
        localStorage.setItem('reviewShowTrays', String(reviewShowTrays));
    }, [reviewShowTrays]);
    const [legacyJob, setLegacyJob] = useState<LegacyJob | null>(null);
    const [legacyJobError, setLegacyJobError] = useState<string | null>(null);
    const [legacyJobLoading, setLegacyJobLoading] = useState(false);
    const [jobPromptOpen, setJobPromptOpen] = useState(false);
    const [jobPromptJob, setJobPromptJob] = useState<LegacyJob | null>(null);
    const [jobPromptBusy, setJobPromptBusy] = useState(false);
    const emptyLegacySteps: LegacyJobSteps = {
        vod: false,
        audio: false,
        sanitize: false,
        srt: false,
        train: false,
        tts: false,
    };
    const waveformRef = useRef<HTMLCanvasElement | null>(null);
    const waveformShellRef = useRef<HTMLDivElement | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const cursorRef = useRef<HTMLDivElement | null>(null);
    const cleanWaveformRef = useRef<HTMLCanvasElement | null>(null);
    const cleanWaveformShellRef = useRef<HTMLDivElement | null>(null);
    const cleanAudioRef = useRef<HTMLAudioElement | null>(null);
    const cleanCursorRef = useRef<HTMLDivElement | null>(null);
    const compareOriginalRef = useRef<HTMLCanvasElement | null>(null);
    const compareCleanRef = useRef<HTMLCanvasElement | null>(null);
    const compareShellRef = useRef<HTMLDivElement | null>(null);
    const compareCursorRef = useRef<HTMLDivElement | null>(null);
    const abPreviewRef = useRef(false);
    const abTimerRef = useRef<number | null>(null);
    const extractLogRef = useRef<HTMLDivElement | null>(null);
    const sanitizeLogRef = useRef<HTMLDivElement | null>(null);
    const srtLogRef = useRef<HTMLDivElement | null>(null);
    const trainLogRef = useRef<HTMLDivElement | null>(null);
    const ttsLogRef = useRef<HTMLDivElement | null>(null);
    const sanitizeAbortRef = useRef<AbortController | null>(null);
    const legacyJobRef = useRef<LegacyJob | null>(null);

    const extractRef = useRef<HTMLDivElement | null>(null);
    const sanitizeRef = useRef<HTMLDivElement | null>(null);
    const reviewRef = useRef<HTMLDivElement | null>(null);
    const srtRef = useRef<HTMLDivElement | null>(null);
    const trainRef = useRef<HTMLDivElement | null>(null);
    const ttsRef = useRef<HTMLDivElement | null>(null);
    const revealStateRef = useRef({
        extract: false,
        sanitize: false,
        review: false,
        srt: false,
        train: false,
        tts: false,
    });

    const legacyRequest = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
        const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/legacy${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...(init.headers || {}),
            },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = (data as { detail?: string }).detail || response.statusText;
            throw new Error(detail);
        }
        return data as T;
    }, []);

    const legacyPost = useCallback(
        async <T,>(path: string, body: unknown): Promise<T> =>
            legacyRequest(path, { method: 'POST', body: JSON.stringify(body) }),
        [legacyRequest]
    );

    const legacyPostNoBody = useCallback(
        async <T,>(path: string): Promise<T> => legacyRequest(path, { method: 'POST' }),
        [legacyRequest]
    );

    const legacyGet = useCallback(async <T,>(path: string): Promise<T> => legacyRequest(path), [legacyRequest]);

    const legacyPut = useCallback(
        async <T,>(path: string, body: unknown): Promise<T> =>
            legacyRequest(path, { method: 'PUT', body: JSON.stringify(body) }),
        [legacyRequest]
    );

    const legacyDelete = useCallback(
        async <T,>(path: string): Promise<T> => legacyRequest(path, { method: 'DELETE' }),
        [legacyRequest]
    );

    const parseProgressFromLog = useCallback((line: string): number | null => {
        const match = line.match(/(\d{1,3})%/);
        if (!match) return null;
        const value = Number(match[1]);
        if (!Number.isFinite(value) || value < 0 || value > 100) return null;
        return value;
    }, []);

    const appendLog = useCallback((prev: string[] | undefined, line: string): string[] => {
        const next = [...(prev ?? []), line];
        if (next.length <= MAX_LOG_LINES) return next;
        return next.slice(-MAX_LOG_LINES);
    }, []);

    const resetPipelineState = useCallback(() => {
        setExtractState({ status: 'idle' });
        setSanitizeState({ status: 'idle' });
        setSrtState({ status: 'idle' });
        setTrainState({ status: 'idle' });
        setTtsState({ status: 'idle' });
        setSanitizeProgress(null);
        setAudioPath(null);
        setCleanPath(null);
        setSrtPath(null);
        setDatasetPath(null);
        setTtsPath(null);
    }, []);

    const resetRevealState = useCallback(() => {
        revealStateRef.current = {
            extract: false,
            sanitize: false,
            review: false,
            srt: false,
            train: false,
            tts: false,
        };
    }, []);

    const applyLegacyJob = useCallback((job: LegacyJob | null) => {
        setLegacyJob(job);
        if (!job) {
            resetPipelineState();
            resetRevealState();
            return;
        }

        const outputs = job.outputs ?? {};
        setAudioPath(outputs.audioPath ?? null);
        setCleanPath(outputs.sanitizePath ?? null);
        setSrtPath(outputs.srtPath ?? null);
        setDatasetPath(outputs.datasetPath ?? null);
        setTtsPath(outputs.ttsPath ?? null);

        setExtractState(
            job.steps.audio
                ? { status: 'done', message: 'Audio extracted', outputPath: outputs.audioPath ?? undefined }
                : { status: 'idle' }
        );
        setSanitizeState(
            job.steps.sanitize
                ? { status: 'done', message: 'Sanitize complete', outputPath: outputs.sanitizePath ?? undefined }
                : { status: 'idle' }
        );
        setSanitizeProgress(job.steps.sanitize ? 100 : null);
        setSrtState(
            job.steps.srt
                ? { status: 'done', message: 'SRT generated', outputPath: outputs.srtPath ?? undefined }
                : { status: 'idle' }
        );
        setTrainState(
            job.steps.train
                ? { status: 'done', message: 'Dataset ready', outputPath: outputs.datasetPath ?? undefined }
                : { status: 'idle' }
        );
        setTtsState(
            job.steps.tts
                ? { status: 'done', message: 'TTS generated', outputPath: outputs.ttsPath ?? undefined }
                : { status: 'idle' }
        );
    }, [resetPipelineState, resetRevealState]);

    const getArtifactUrl = useCallback((path: string): string => {
        const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
        return `${baseUrl}/legacy/artifact?path=${encodeURIComponent(path)}`;
    }, []);

    const renderWaveform = useCallback(
        async (
            path: string | null,
            canvas: HTMLCanvasElement | null,
            setReady: (value: boolean) => void,
            color: string
        ) => {
            if (!path || !canvas || typeof window === 'undefined') {
                setReady(false);
                return;
            }

            const controller = new AbortController();
            try {
                const response = await fetch(getArtifactUrl(path), { signal: controller.signal });
                const arrayBuffer = await response.arrayBuffer();
                const audioContext = new (window.AudioContext || (window as typeof window & {
                    webkitAudioContext?: typeof AudioContext;
                }).webkitAudioContext)();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    await audioContext.close();
                    return;
                }

                const width = canvas.clientWidth || 640;
                const height = canvas.clientHeight || 96;
                const dpr = window.devicePixelRatio || 1;
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                ctx.scale(dpr, dpr);
                ctx.clearRect(0, 0, width, height);

                const channelData = audioBuffer.getChannelData(0);
                const samplesPerPixel = Math.max(1, Math.floor(channelData.length / width));
                const mid = height / 2;
                const amplitude = height * 0.4;

                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.beginPath();

                for (let x = 0; x < width; x += 1) {
                    const start = x * samplesPerPixel;
                    let min = 1;
                    let max = -1;
                    for (let i = 0; i < samplesPerPixel; i += 1) {
                        const sample = channelData[start + i] ?? 0;
                        if (sample < min) min = sample;
                        if (sample > max) max = sample;
                    }
                    const y1 = mid + min * amplitude;
                    const y2 = mid + max * amplitude;
                    ctx.moveTo(x + 0.5, y1);
                    ctx.lineTo(x + 0.5, y2);
                }

                ctx.stroke();
                await audioContext.close();
                setReady(true);
            } catch {
                setReady(false);
            }

            return () => controller.abort();
        },
        [getArtifactUrl]
    );

    useEffect(() => {
        renderWaveform(audioPath, waveformRef.current, setWaveformReady, 'rgba(120, 255, 248, 0.9)');
    }, [audioPath, renderWaveform]);

    useEffect(() => {
        renderWaveform(cleanPath, cleanWaveformRef.current, setCleanWaveformReady, 'rgba(120, 255, 248, 0.9)');
        renderWaveform(cleanPath, compareCleanRef.current, () => { }, 'rgba(120, 255, 248, 0.95)');
        renderWaveform(audioPath, compareOriginalRef.current, () => { }, 'rgba(241, 196, 102, 0.7)');
    }, [audioPath, cleanPath, renderWaveform]);

    const scrollLogToEnd = (panel: HTMLDivElement | null) => {
        if (!panel) return;
        panel.scrollTop = panel.scrollHeight;
    };

    useEffect(() => {
        scrollLogToEnd(extractLogRef.current);
    }, [extractState.log?.length]);

    useEffect(() => {
        scrollLogToEnd(sanitizeLogRef.current);
    }, [sanitizeState.log?.length]);

    useEffect(() => {
        scrollLogToEnd(srtLogRef.current);
    }, [srtState.log?.length]);

    useEffect(() => {
        scrollLogToEnd(trainLogRef.current);
    }, [trainState.log?.length]);

    useEffect(() => {
        scrollLogToEnd(ttsLogRef.current);
    }, [ttsState.log?.length]);

    useEffect(() => {
        let frameId = 0;

        const updateCursor = (
            audio: HTMLAudioElement | null,
            shell: HTMLDivElement | null,
            cursor: HTMLDivElement | null
        ) => {
            if (!audio || !shell || !cursor) return;
            const duration = audio.duration || 0;
            const ratio = duration > 0 ? audio.currentTime / duration : 0;
            const width = shell.clientWidth || 1;
            cursor.style.transform = `translateX(${Math.max(0, Math.min(width, ratio * width))}px)`;
        };

        const tick = () => {
            updateCursor(audioRef.current, waveformShellRef.current, cursorRef.current);
            updateCursor(cleanAudioRef.current, cleanWaveformShellRef.current, cleanCursorRef.current);
            updateCursor(cleanAudioRef.current, compareShellRef.current, compareCursorRef.current);
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, [waveformReady, cleanWaveformReady]);

    const handleWaveformSeek = (
        event: React.MouseEvent<HTMLDivElement>,
        audio: HTMLAudioElement | null,
        shell: HTMLDivElement | null
    ): void => {
        if (!audio || !shell) return;
        const rect = shell.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        if (audio.duration && Number.isFinite(audio.duration)) {
            audio.currentTime = audio.duration * ratio;
        }
    };

    const handleSanitizedPlay = async (): Promise<void> => {
        if (!compareEnabled || abPreviewRef.current) return;
        const cleanAudio = cleanAudioRef.current;
        const originalAudio = audioRef.current;
        if (!cleanAudio || !originalAudio) return;
        abPreviewRef.current = true;
        const startTime = cleanAudio.currentTime || 0;
        try {
            cleanAudio.pause();
            originalAudio.currentTime = startTime;
            await originalAudio.play();
            if (abTimerRef.current) {
                window.clearTimeout(abTimerRef.current);
            }
            abTimerRef.current = window.setTimeout(async () => {
                originalAudio.pause();
                cleanAudio.currentTime = startTime;
                await cleanAudio.play();
                abPreviewRef.current = false;
            }, 2000);
        } catch {
            abPreviewRef.current = false;
        }
    };

    const loadLegacyJob = useCallback(
        async (url: string) => {
            if (!url) return;
            setLegacyJobLoading(true);
            setLegacyJobError(null);
            try {
                const jobs = await legacyGet<LegacyJob[]>('/jobs');
                const matching = jobs.filter((entry) => entry.vodUrl === url);
                const selected = matching.sort((a, b) => {
                    const aTime = Date.parse(a.updatedAt) || 0;
                    const bTime = Date.parse(b.updatedAt) || 0;
                    return bTime - aTime;
                })[0];
                const current = legacyJobRef.current;
                if (selected) {
                    if (current && current.id === selected.id) {
                        applyLegacyJob(selected);
                    } else {
                        setJobPromptJob(selected);
                        setJobPromptOpen(true);
                    }
                } else {
                    applyLegacyJob(null);
                }
            } catch (error) {
                setLegacyJobError((error as Error).message);
                applyLegacyJob(null);
            } finally {
                setLegacyJobLoading(false);
            }
        },
        [applyLegacyJob, legacyGet]
    );

    const ensureLegacyJob = useCallback(async (): Promise<LegacyJob | null> => {
        if (legacyJob || !metadata || !vodUrl.trim()) return legacyJob;
        try {
            const created = await legacyPost<LegacyJob>('/jobs', {
                vodUrl,
                streamer: metadata.streamer,
                title: metadata.title,
            });
            applyLegacyJob(created);
            return created;
        } catch (error) {
            setLegacyJobError((error as Error).message);
            return null;
        }
    }, [legacyJob, metadata, vodUrl, legacyPost, applyLegacyJob]);

    const updateLegacyJob = useCallback(
        async (stepUpdate: Partial<LegacyJobSteps>, outputUpdate: Partial<LegacyJobOutputs>) => {
            if (!legacyJob) return;
            const nextSteps: LegacyJobSteps = {
                ...emptyLegacySteps,
                ...legacyJob.steps,
                ...stepUpdate,
            };
            const nextOutputs: LegacyJobOutputs = {
                ...(legacyJob.outputs ?? {}),
                ...outputUpdate,
            };
            try {
                const updated = await legacyPut<LegacyJob>(`/jobs/${legacyJob.id}`, {
                    steps: nextSteps,
                    outputs: nextOutputs,
                });
                setLegacyJob(updated);
            } catch (error) {
                setLegacyJobError((error as Error).message);
            }
        },
        [legacyJob, legacyPut, emptyLegacySteps]
    );

    const handleSearch = async (url: string): Promise<void> => {
        setVodInput(url);
    };

    useEffect(() => {
        if (debounceRef.current) {
            window.clearTimeout(debounceRef.current);
        }

        if (!vodInput.trim()) {
            setVodUrl('');
            setVodInvalid(false);
            resetMetadata();
            applyLegacyJob(null);
            setLegacyJobError(null);
            setJobPromptOpen(false);
            setJobPromptJob(null);
            return;
        }

        debounceRef.current = window.setTimeout(async () => {
            const parsed = parseVodUrl(vodInput.trim());
            if (!parsed) {
                setVodInvalid(true);
                applyLegacyJob(null);
                return;
            }

            setVodInvalid(false);
            resetRevealState();
            setVodUrl(vodInput.trim());
            resetMetadata();
            await fetchMetadata(parsed.vodId, parsed.platform);
            await loadLegacyJob(vodInput.trim());
        }, 650);

        return () => {
            if (debounceRef.current) {
                window.clearTimeout(debounceRef.current);
            }
        };
    }, [vodInput, fetchMetadata, resetMetadata, loadLegacyJob, applyLegacyJob, resetRevealState]);

    useEffect(() => {
        legacyJobRef.current = legacyJob;
    }, [legacyJob]);

    const handleCreateJob = async (): Promise<void> => {
        if (!vodUrl.trim() || !metadata) return;
        setLegacyJobError(null);
        try {
            const created = await legacyPost<LegacyJob>('/jobs', {
                vodUrl,
                streamer: metadata.streamer,
                title: metadata.title,
            });
            applyLegacyJob(created);
        } catch (error) {
            setLegacyJobError((error as Error).message);
        }
    };

    const handleJobContinue = () => {
        applyLegacyJob(jobPromptJob ?? null);
        setJobPromptOpen(false);
        setJobPromptJob(null);
    };

    const handleJobStartOver = async (): Promise<void> => {
        if (!jobPromptJob || !metadata) return;
        setJobPromptBusy(true);
        setLegacyJobError(null);
        try {
            await legacyDelete(`/jobs/${jobPromptJob.id}/purge`);
            applyLegacyJob(null);
            resetRevealState();
            resetPipelineState();
            const created = await legacyPost<LegacyJob>('/jobs', {
                vodUrl,
                streamer: metadata.streamer,
                title: metadata.title,
            });
            applyLegacyJob(created);
        } catch (error) {
            setLegacyJobError((error as Error).message);
        } finally {
            setJobPromptBusy(false);
            setJobPromptOpen(false);
            setJobPromptJob(null);
        }
    };

    const runExtract = async (): Promise<void> => {
        if (!vodUrl.trim()) return;
        await ensureLegacyJob();
        setExtractState({ status: 'running', message: 'Extracting audio...' });
        setExtractProgress(0);

        // Estimated progress animation (download 0-50%, extraction 50-95%)
        const startTime = Date.now();
        const estimatedDuration = 120000; // 2 minutes estimate
        const progressInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const ratio = Math.min(elapsed / estimatedDuration, 0.95);
            setExtractProgress(Math.round(ratio * 100));
        }, 500);

        try {
            const result = await legacyPost<{ path: string; log: string[] }>(
                '/audio/run',
                {
                    vodUrl,
                    vodQuality,
                    authToken: authToken.trim() || undefined,
                }
            );
            clearInterval(progressInterval);
            setExtractProgress(100);
            setAudioPath(result.path);
            setExtractState({
                status: 'done',
                message: 'Audio extracted',
                log: result.log.slice(-MAX_LOG_LINES),
                outputPath: result.path,
            });
            setSanitizeState({ status: 'ready' });
            await updateLegacyJob({ audio: true }, { audioPath: result.path });
        } catch (error) {
            clearInterval(progressInterval);
            const message = (error as Error).message;
            setExtractState({ status: 'error', message, log: [message] });
            setExtractProgress(null);
        }
    };

    const runSanitize = async (): Promise<void> => {
        if (!vodUrl.trim()) return;
        const job = await ensureLegacyJob();
        setSanitizeState({ status: 'running', message: 'Sanitizing audio...', log: [] });
        setSanitizeProgress(0);
        const controller = new AbortController();
        sanitizeAbortRef.current = controller;

        // Map frontend presets to backend presets with optimized settings
        let backendPreset: 'strict' | 'balanced' | 'lenient' = sanitizePreset === 'rapid' || sanitizePreset === 'performance' ? 'lenient' : sanitizePreset;
        let effectiveStrictness = sanitizeStrictness;
        let effectiveExtractVocals = sanitizeExtractVocals;

        if (sanitizePreset === 'rapid') {
            // Rapid: maximum speed, minimum processing
            backendPreset = 'lenient';
            effectiveStrictness = 0.3;
            effectiveExtractVocals = false;
        } else if (sanitizePreset === 'performance') {
            // Performance: balanced speed and quality
            backendPreset = 'lenient';
            effectiveStrictness = 0.4;
            effectiveExtractVocals = false;
        }

        try {
            const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/legacy/sanitize/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vodUrl,
                    mode: sanitizeMode,
                    preset: backendPreset,
                    strictness: effectiveStrictness,
                    extractVocals: effectiveExtractVocals,
                    stream: true,
                    jobId: job?.id ?? undefined,
                }),
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                const payload = await response.json().catch(() => ({}));
                const detail = (payload as { detail?: string }).detail || response.statusText;
                throw new Error(detail);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    const evt = JSON.parse(trimmed) as {
                        type: string;
                        line?: string;
                        error?: string;
                        result?: {
                            cleanPath: string;
                            log?: string[];
                        };
                    };

                    if (evt.type === 'log' && evt.line) {
                        const progress = parseProgressFromLog(evt.line);
                        if (progress !== null) {
                            setSanitizeProgress(progress);
                        }
                        setSanitizeState((prev) => ({
                            ...prev,
                            log: appendLog(prev.log, evt.line as string),
                        }));
                    }

                    if (evt.type === 'error') {
                        setSanitizeState({ status: 'error', message: evt.error || 'Sanitize failed' });
                    }

                    if (evt.type === 'done' && evt.result) {
                        setCleanPath(evt.result.cleanPath);
                        setSanitizeProgress(100);
                        setSanitizeState((prev) => ({
                            status: 'done',
                            message: 'Sanitize complete',
                            log: [...(prev.log ?? []), ...(evt.result?.log ?? [])].slice(-MAX_LOG_LINES),
                            outputPath: evt.result?.cleanPath,
                        }));
                        setSrtState({ status: 'ready' });
                        await updateLegacyJob(
                            { sanitize: true },
                            { sanitizePath: evt.result.cleanPath }
                        );
                    }
                }
            }
        } catch (error) {
            if ((error as DOMException).name === 'AbortError') {
                setSanitizeProgress(0);
                setSanitizeState((prev) => ({
                    status: 'error',
                    message: 'Sanitize canceled by user',
                    log: appendLog(prev.log, '[cancel] user requested stop'),
                }));
                return;
            }
            setSanitizeState({ status: 'error', message: (error as Error).message });
        } finally {
            sanitizeAbortRef.current = null;
        }
    };

    const runSrt = async (): Promise<void> => {
        if (!vodUrl.trim()) return;
        await ensureLegacyJob();
        setSrtState({ status: 'running', message: 'Transcribing...' });
        try {
            const result = await legacyPost<{ path: string; log: string[] }>(
                '/srt/run',
                { vodUrl }
            );
            setSrtPath(result.path);
            setSrtState({
                status: 'done',
                message: 'SRT generated',
                log: result.log.slice(-MAX_LOG_LINES),
                outputPath: result.path,
            });
            setTrainState({ status: 'ready' });
            await updateLegacyJob({ srt: true }, { srtPath: result.path });
        } catch (error) {
            setSrtState({ status: 'error', message: (error as Error).message });
        }
    };

    const runTrain = async (): Promise<void> => {
        if (!vodUrl.trim()) return;
        await ensureLegacyJob();
        setTrainState({ status: 'running', message: 'Building dataset...' });
        try {
            const result = await legacyPost<{ datasetPath: string; log: string[] }>(
                '/train/run',
                { vodUrl }
            );
            setDatasetPath(result.datasetPath);
            setTrainState({
                status: 'done',
                message: 'Dataset ready',
                log: result.log.slice(-MAX_LOG_LINES),
                outputPath: result.datasetPath,
            });
            setTtsState({ status: 'ready' });
            await updateLegacyJob({ train: true }, { datasetPath: result.datasetPath });
        } catch (error) {
            setTrainState({ status: 'error', message: (error as Error).message });
        }
    };

    const runTts = async (): Promise<void> => {
        if (!vodUrl.trim() || !metadata) return;
        await ensureLegacyJob();
        setTtsState({ status: 'running', message: 'Generating TTS...' });
        try {
            const result = await legacyPost<{ outputPath: string; log: string[] }>(
                '/tts/run',
                {
                    vodUrl,
                    streamer: metadata.streamer,
                    text: ttsText,
                }
            );
            setTtsPath(result.outputPath);
            setTtsState({
                status: 'done',
                message: 'TTS generated',
                log: result.log.slice(-MAX_LOG_LINES),
                outputPath: result.outputPath,
            });
            await updateLegacyJob({ tts: true }, { ttsPath: result.outputPath });
        } catch (error) {
            setTtsState({ status: 'error', message: (error as Error).message });
        }
    };

    const stepStatus = useMemo(() => {
        const jobReady = Boolean(legacyJob);
        const vodStep: StepStatus = metadata ? 'done' : 'ready';
        const extractStep: StepStatus =
            extractState.status === 'idle'
                ? jobReady
                    ? 'ready'
                    : 'blocked'
                : extractState.status;
        const sanitizeStep: StepStatus =
            sanitizeState.status === 'idle'
                ? extractState.status === 'done'
                    ? 'ready'
                    : 'blocked'
                : sanitizeState.status;
        const reviewStep: StepStatus = sanitizeState.status === 'done' ? 'ready' : 'blocked';
        const srtStep: StepStatus =
            srtState.status === 'idle'
                ? sanitizeState.status === 'done'
                    ? 'ready'
                    : 'blocked'
                : srtState.status;
        const trainStep: StepStatus =
            trainState.status === 'idle'
                ? srtState.status === 'done'
                    ? 'ready'
                    : 'blocked'
                : trainState.status;
        const ttsStep: StepStatus =
            ttsState.status === 'idle'
                ? trainState.status === 'done'
                    ? 'ready'
                    : 'blocked'
                : ttsState.status;

        return [vodStep, extractStep, sanitizeStep, reviewStep, srtStep, trainStep, ttsStep];
    }, [metadata, legacyJob, extractState, sanitizeState, srtState, trainState, ttsState]);

    const pipelineProgress = useMemo(
        () => overallProgressForSteps([
            { status: extractState.status },
            { status: sanitizeState.status, progress: sanitizeProgress },
            { status: srtState.status },
            { status: trainState.status },
            { status: ttsState.status },
        ]),
        [extractState.status, sanitizeState.status, srtState.status, trainState.status, ttsState.status, sanitizeProgress]
    );

    const sanitizeProgressValue = useMemo(
        () => progressValueForStep(sanitizeState.status, sanitizeProgress),
        [sanitizeState.status, sanitizeProgress]
    );

    const extractProgressValue = useMemo(
        () => progressValueForStep(extractState.status, extractProgress),
        [extractState.status, extractProgress]
    );

    const sanitizeSuggestion = useMemo(() => {
        if (sanitizeState.status !== 'error') return null;
        const msg = sanitizeState.message?.toLowerCase() ?? '';
        if (!msg.includes('no speech retained') && !msg.includes('no segments')) return null;

        // If UVR was enabled, suggest turning it off
        const suggestedExtractVocals = false;
        const suggestedPreset: 'strict' | 'balanced' | 'lenient' = 'lenient';
        const suggestedStrictness = 0.4;

        return {
            title: 'Sanitize returned 0 segments',
            reason: sanitizeExtractVocals
                ? 'UVR vocal isolation may have been too aggressive. Try disabling it and using more lenient settings.'
                : 'Settings may be too strict. Try more lenient settings.',
            settings: {
                preset: suggestedPreset,
                strictness: suggestedStrictness,
                extractVocals: suggestedExtractVocals,
            },
        };
    }, [sanitizeState.status, sanitizeState.message, sanitizeExtractVocals]);

    const activeRun = useMemo(() => {
        if (extractState.status === 'running') return { key: 'extract' as RunKey, label: 'Extract audio' };
        if (sanitizeState.status === 'running') return { key: 'sanitize' as RunKey, label: 'Sanitize audio' };
        if (srtState.status === 'running') return { key: 'srt' as RunKey, label: 'Transcribe (SRT)' };
        if (trainState.status === 'running') return { key: 'train' as RunKey, label: 'Train dataset' };
        if (ttsState.status === 'running') return { key: 'tts' as RunKey, label: 'Generate TTS' };
        return null;
    }, [extractState.status, sanitizeState.status, srtState.status, trainState.status, ttsState.status]);

    const canStopActive = activeRun?.key === 'sanitize';

    const handleStopActiveRun = async (): Promise<void> => {
        if (!activeRun) return;
        if (activeRun.key !== 'sanitize') return;
        sanitizeAbortRef.current?.abort();
        if (legacyJob?.id) {
            try {
                await legacyPostNoBody(`/jobs/${legacyJob.id}/cancel`);
            } catch (error) {
                setLegacyJobError((error as Error).message);
            }
        }
    };

    const showExtract = Boolean(legacyJob);
    const showSanitize = extractState.status === 'done';
    const showReview = sanitizeState.status === 'done';
    const showSrt = sanitizeState.status === 'done';
    const showTrain = srtState.status === 'done';
    const showTts = trainState.status === 'done';

    useEffect(() => {
        const steps = [
            { key: 'extract', visible: showExtract, ref: extractRef },
            { key: 'sanitize', visible: showSanitize, ref: sanitizeRef },
            { key: 'review', visible: showReview, ref: reviewRef },
            { key: 'srt', visible: showSrt, ref: srtRef },
            { key: 'train', visible: showTrain, ref: trainRef },
            { key: 'tts', visible: showTts, ref: ttsRef },
        ] as const;

        steps.forEach((step) => {
            const previous = revealStateRef.current[step.key];
            if (step.visible && !previous) {
                step.ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            revealStateRef.current[step.key] = step.visible;
        });
    }, [showExtract, showSanitize, showReview, showSrt, showTrain, showTts]);

    return (
        <div className="wizard-page p-6 grid-bg">
            <div className="max-w-6xl mx-auto space-y-10">
                <div className="glass rounded-3xl p-8 fade-up">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-3">
                            <span className="accent-chip text-xs font-semibold px-3 py-1 rounded-full inline-flex">
                                Wizard Mode
                            </span>
                            <h1 className="hero-title text-white font-semibold">
                                Streamer datasets from VODs, step by step.
                            </h1>
                            <p className="text-sm text-slate-400 max-w-2xl">
                                Validate, extract, sanitize, review, transcribe, and train with a simple guided flow.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button className="primary-btn px-5 py-3 rounded-xl text-sm font-semibold transition-all">
                                Start new run
                            </button>
                            <button className="secondary-btn px-5 py-3 rounded-xl text-sm font-semibold transition-all">
                                See recent jobs
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-7 float-in">
                    {[
                        'VOD',
                        'Extract',
                        'Sanitize',
                        'Review',
                        'SRT',
                        'Train',
                        'TTS',
                    ].map((label, index) => (
                        <div
                            key={label}
                            className="step-card rounded-2xl p-3 text-center transition-transform hover:-translate-y-1"
                        >
                            <div className="text-xs text-slate-400">Step {index + 1}</div>
                            <div className="text-sm font-medium text-slate-100">{label}</div>
                            <div
                                className={`mt-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusClass(
                                    stepStatus[index]
                                )}`}
                            >
                                {stepStatus[index]}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="glass rounded-2xl p-4">
                    <div className="timeline">
                        {[
                            'VOD',
                            'Extract',
                            'Sanitize',
                            'Review',
                            'SRT',
                            'Train',
                            'TTS',
                        ].map((label, index) => (
                            <div key={label} className="timeline-item">
                                <span className={`timeline-dot ${stepStatus[index]}`}></span>
                                <span className="text-xs text-slate-400">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <details className="glass rounded-2xl p-6 legend-panel">
                    <summary className="legend-summary">Legend and help</summary>
                    <div className="legend-body">
                        <p className="text-sm text-slate-400">
                            Each control below has a quick tooltip, and this legend explains what every step does.
                        </p>
                        <div className="legend-grid">
                            <div>
                                <h3 className="legend-title">Step 1 - VOD</h3>
                                <ul className="legend-list">
                                    <li><strong>VOD URL:</strong> Paste a Twitch or YouTube link to fetch metadata.</li>
                                    <li><strong>Platform badge:</strong> Auto-detects Twitch vs YouTube.</li>
                                    <li><strong>Create Job:</strong> Creates a job and unlocks extraction.</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="legend-title">Step 2 - Extract</h3>
                                <ul className="legend-list">
                                    <li><strong>Quality:</strong> Select Twitch stream quality to download.</li>
                                    <li><strong>Auth token:</strong> Optional token for restricted VODs.</li>
                                    <li><strong>Waveform:</strong> Click to seek; player previews extracted WAV.</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="legend-title">Step 3 - Sanitize</h3>
                                <ul className="legend-list">
                                    <li><strong>Mode:</strong> Auto speech detection or voice-sample guided mode.</li>
                                    <li><strong>Preset:</strong> Strict = cleaner, lenient = more clips.</li>
                                    <li><strong>Strictness:</strong> 0-1 filter intensity.</li>
                                    <li><strong>UVR:</strong> Optional vocal isolation to reduce music/SFX.</li>
                                    <li><strong>Compare:</strong> Split slider overlays original vs sanitized.</li>
                                    <li><strong>A/B play:</strong> 2s original then sanitized at same timestamp.</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="legend-title">Steps 4-7</h3>
                                <ul className="legend-list">
                                    <li><strong>Review:</strong> Manual accept/reject segments.</li>
                                    <li><strong>SRT:</strong> Generate subtitles with faster-whisper.</li>
                                    <li><strong>Train:</strong> Build dataset from clean audio + SRT.</li>
                                    <li><strong>TTS:</strong> Generate a test voice sample from your dataset.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </details>

                <section className="glass rounded-2xl p-6 space-y-4">
                    <h2 className="text-xl font-semibold text-white">
                        Step 1 - VOD Validation
                        <span className="help-tip" data-tip="Paste a VOD URL to fetch metadata and unlock the rest of the flow.">?</span>
                    </h2>
                    <p className="text-sm text-slate-400">
                        Paste a Twitch or YouTube VOD URL to fetch metadata.
                    </p>

                    <div className="mt-4">
                        <label className="text-sm text-slate-400">
                            VOD URL
                            <span className="help-tip" data-tip="Supports Twitch and YouTube. Metadata is fetched automatically.">?</span>
                        </label>
                        <VodSearch
                            onSearch={handleSearch}
                            isLoading={isFetching}
                            value={vodInput}
                            onChange={setVodInput}
                            showButton={false}
                            showPlatformHints={true}
                        />
                    </div>

                    {fetchError && (
                        <div className="mt-4 p-3 rounded-lg border border-rose-500/30 bg-rose-500/10">
                            <p className="text-rose-200 text-sm">{fetchError.message}</p>
                        </div>
                    )}

                    {isFetching && (
                        <div className="mt-6 skeleton-card">
                            <div className="skeleton-block mb-4"></div>
                            <div className="space-y-3">
                                <div className="skeleton-line"></div>
                                <div className="skeleton-line" style={{ width: '80%' }}></div>
                                <div className="skeleton-line" style={{ width: '60%' }}></div>
                            </div>
                        </div>
                    )}

                    {!isFetching && vodInvalid && (
                        <div className="mt-6 skeleton-card">
                            <div className="skeleton-invalid">
                                <span className="text-2xl">:(</span>
                                <div>
                                    <p className="text-sm font-semibold">Invalid VOD link</p>
                                    <p className="text-xs text-slate-400">Paste a Twitch or YouTube VOD URL.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {metadata && (
                        <div className="mt-6">
                            <VodMetadataCard
                                vodId={metadata.vodId}
                                streamer={metadata.streamer}
                                title={metadata.title}
                                durationSeconds={metadata.durationSeconds}
                                previewUrl={metadata.previewUrl}
                                platform={metadata.platform}
                                description={metadata.description}
                                url={metadata.url}
                                viewCount={metadata.viewCount}
                                createdAt={metadata.createdAt}
                                publishedAt={metadata.publishedAt}
                                language={metadata.language}
                                userLogin={metadata.userLogin}
                                videoType={metadata.videoType}
                                gameName={metadata.gameName}
                                onCreateJob={handleCreateJob}
                            />
                            {legacyJob && (
                                <div className="mt-4 text-sm text-emerald-300">
                                    Loaded job: {legacyJob.id}
                                </div>
                            )}
                            {legacyJobLoading && (
                                <div className="mt-2 text-xs text-slate-500">Checking existing runs...</div>
                            )}
                            {legacyJobError && (
                                <div className="mt-2 text-xs text-rose-300">{legacyJobError}</div>
                            )}
                        </div>
                    )}
                </section>

                {showExtract && (
                    <section ref={extractRef} className="glass rounded-2xl p-6 space-y-4 step-reveal">
                        <div>
                            <h2 className="text-xl font-semibold text-white">
                                Step 2 - Extract Audio
                                <span className="help-tip" data-tip="Downloads the VOD and extracts a WAV for preview and sanitization.">?</span>
                            </h2>
                            <p className="text-sm text-slate-400">
                                Download the VOD and extract audio to WAV.
                            </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <label className="text-sm text-slate-400">
                                    Quality
                                    <span className="help-tip" data-tip="Select the Twitch stream quality to download.">?</span>
                                </label>
                                <select
                                    value={vodQuality}
                                    onChange={(event) => setVodQuality(event.target.value)}
                                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
                                >
                                    <option value="audio_only">Audio Only (recommended)</option>
                                    <option value="source">Source</option>
                                    <option value="1080p60">1080p60</option>
                                    <option value="1080p">1080p</option>
                                    <option value="720p60">720p60</option>
                                    <option value="720p">720p</option>
                                    <option value="480p">480p</option>
                                    <option value="360p">360p</option>
                                    <option value="160p">160p</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-slate-400">
                                    Auth Token (optional)
                                    <span className="help-tip" data-tip="Use for subscriber-only or restricted VODs.">?</span>
                                </label>
                                <input
                                    value={authToken}
                                    onChange={(event) => setAuthToken(event.target.value)}
                                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
                                    placeholder="TWITCHDL_AUTH_TOKEN"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={runExtract}
                                disabled={extractState.status === 'running' || stepStatus[1] === 'blocked'}
                                className="primary-btn px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60 transition-all"
                            >
                                {extractState.status === 'running' ? 'Extracting...' : 'Extract Audio'}
                            </button>
                            <span className="help-tip" data-tip="Starts the download + extraction pipeline for this VOD.">?</span>
                            {audioPath && (
                                <span className="text-sm output-glow mono">Output: {audioPath}</span>
                            )}
                        </div>

                        {audioPath && (
                            <div className="audio-player-shell">
                                <div className="text-xs text-slate-400 mb-2">Extracted audio preview</div>
                                <div
                                    className="audio-waveform"
                                    ref={waveformShellRef}
                                    onClick={(event) => handleWaveformSeek(event, audioRef.current, waveformShellRef.current)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            handleWaveformSeek(
                                                event as unknown as React.MouseEvent<HTMLDivElement>,
                                                audioRef.current,
                                                waveformShellRef.current
                                            );
                                        }
                                    }}
                                >
                                    <canvas ref={waveformRef} className="audio-waveform-canvas" />
                                    <div ref={cursorRef} className="audio-waveform-cursor" />
                                    {!waveformReady && (
                                        <div className="audio-waveform-placeholder">
                                            <div className="audio-waveform-skeleton">
                                                <div className="skeleton-line"></div>
                                                <div className="skeleton-line" style={{ width: '70%' }}></div>
                                                <div className="skeleton-line" style={{ width: '85%' }}></div>
                                            </div>
                                            <div className="audio-waveform-bubbles">
                                                <span className="wave-bubble"></span>
                                                <span className="wave-bubble"></span>
                                                <span className="wave-bubble"></span>
                                                <span className="wave-bubble"></span>
                                            </div>
                                            <span className="audio-waveform-label">Rendering waveform...</span>
                                        </div>
                                    )}
                                </div>
                                <audio ref={audioRef} className="audio-player" controls preload="metadata">
                                    <source src={getArtifactUrl(audioPath)} type="audio/wav" />
                                    Your browser does not support the audio element.
                                </audio>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>
                                    Progress
                                    <span className="help-tip" data-tip="Step progress based on current run state.">?</span>
                                </span>
                                <span>{extractProgressValue}%</span>
                            </div>
                            <div className="progress-track">
                                <div
                                    className={progressClass(extractState.status)}
                                    style={{ width: `${extractProgressValue}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="log-panel" ref={extractLogRef}>
                            {extractState.log && extractState.log.length > 0 ? (
                                extractState.log.map((line, idx) => (
                                    <div key={`extract-${idx}`} className="log-line">
                                        {line}
                                    </div>
                                ))
                            ) : extractState.status === 'error' ? (
                                <div className="log-line text-red-400">
                                    {extractState.message || 'Extract failed.'}
                                </div>
                            ) : (
                                <div className="log-line text-slate-500">Waiting for extract logs...</div>
                            )}
                        </div>
                    </section>
                )}

                {showSanitize && (
                    <section ref={sanitizeRef} className="glass rounded-2xl p-6 space-y-4 step-reveal">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-white">
                                    Step 3 - Sanitize
                                    <span className="help-tip" data-tip="Cleans the audio and detects usable speech segments.">?</span>
                                </h2>
                                <p className="text-sm text-slate-400">
                                    Clean audio and detect speech segments.
                                </p>
                            </div>
                            {cleanPath && (
                                <label className="compare-toggle">
                                    <input
                                        type="checkbox"
                                        checked={compareEnabled}
                                        onChange={(event) => setCompareEnabled(event.target.checked)}
                                    />
                                    <span>Compare waveform</span>
                                    <span className="help-tip" data-tip="Split slider overlays original vs sanitized.">?</span>
                                </label>
                            )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                            <div>
                                <label className="text-sm text-slate-400">
                                    Mode
                                    <span className="help-tip" data-tip="Auto detects speech; Voice mode uses voice samples.">?</span>
                                </label>
                                <select
                                    value={sanitizeMode}
                                    onChange={(event) => setSanitizeMode(event.target.value as 'auto' | 'voice')}
                                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
                                >
                                    <option value="auto">Auto</option>
                                    <option value="voice">Voice Samples</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-slate-400">
                                    Preset
                                    <span className="help-tip" data-tip="Rapid/Performance = faster; Strict = cleaner but fewer clips; Lenient = more clips.">?</span>
                                </label>
                                <select
                                    value={sanitizePreset}
                                    onChange={(event) => setSanitizePreset(event.target.value as any)}
                                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
                                >
                                    <option value="rapid">Rapid (fastest)</option>
                                    <option value="performance">Performance (fast)</option>
                                    <option value="balanced">Balanced</option>
                                    <option value="strict">Strict</option>
                                    <option value="lenient">Lenient</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-slate-400">
                                    Strictness
                                    <span className="help-tip" data-tip="0-1 filter intensity; higher = stricter.">?</span>
                                </label>
                                <input
                                    type="number"
                                    value={sanitizeStrictness}
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    onChange={(event) => setSanitizeStrictness(Number(event.target.value))}
                                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
                                />
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                                type="checkbox"
                                checked={sanitizeExtractVocals}
                                onChange={(event) => setSanitizeExtractVocals(event.target.checked)}
                            />
                            Vocal isolation (UVR)
                            <span className="help-tip" data-tip="Optional vocal isolation to reduce music/SFX.">?</span>
                        </label>

                        {sanitizeState.status === 'done' && (
                            <div className="glass rounded-lg p-4 space-y-3">
                                <div className="text-sm font-semibold text-white">
                                    Review Preview Settings
                                    <span className="help-tip" data-tip="Configure performance settings before opening review page.">?</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <label className="flex items-center gap-2 text-xs text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={reviewShowTimeline}
                                            onChange={(e) => setReviewShowTimeline(e.target.checked)}
                                        />
                                        Show Timeline
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={reviewShowTrays}
                                            onChange={(e) => setReviewShowTrays(e.target.checked)}
                                        />
                                        Show Trays
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={reviewPerfMode}
                                            onChange={(e) => setReviewPerfMode(e.target.checked)}
                                        />
                                        Performance Mode
                                    </label>
                                </div>
                                <p className="text-xs text-slate-500">
                                    These settings will be applied when you open the review page. Performance mode hides badges and reduces rendering for better speed on large datasets.
                                </p>
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={runSanitize}
                                disabled={sanitizeState.status === 'running' || stepStatus[2] === 'blocked'}
                                className="primary-btn px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60 transition-all"
                            >
                                {sanitizeState.status === 'running' ? 'Sanitizing...' : 'Run Sanitize'}
                            </button>
                            <span className="help-tip" data-tip="Runs speech detection and writes a cleaned WAV plus segments.">?</span>
                            {cleanPath && (
                                <span className="text-sm output-glow mono">Output: {cleanPath}</span>
                            )}
                        </div>

                        {cleanPath && (
                            <div className="audio-player-shell">
                                <div className="text-xs text-slate-400 mb-2">Sanitized audio preview</div>
                                <div
                                    className={compareEnabled ? 'audio-waveform compare' : 'audio-waveform'}
                                    ref={compareEnabled ? compareShellRef : cleanWaveformShellRef}
                                    onClick={(event) =>
                                        handleWaveformSeek(
                                            event,
                                            cleanAudioRef.current,
                                            compareEnabled ? compareShellRef.current : cleanWaveformShellRef.current
                                        )
                                    }
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            handleWaveformSeek(
                                                event as unknown as React.MouseEvent<HTMLDivElement>,
                                                cleanAudioRef.current,
                                                compareEnabled ? compareShellRef.current : cleanWaveformShellRef.current
                                            );
                                        }
                                    }}
                                >
                                    {compareEnabled ? (
                                        <>
                                            <canvas ref={compareOriginalRef} className="audio-waveform-canvas" />
                                            <div className="audio-waveform-overlay" style={{ width: `${comparePosition}%` }}>
                                                <canvas ref={compareCleanRef} className="audio-waveform-canvas" />
                                            </div>
                                            <div ref={compareCursorRef} className="audio-waveform-cursor" />
                                            <div className="audio-waveform-handle" style={{ left: `${comparePosition}%` }} />
                                        </>
                                    ) : (
                                        <>
                                            <canvas ref={cleanWaveformRef} className="audio-waveform-canvas" />
                                            <div ref={cleanCursorRef} className="audio-waveform-cursor" />
                                        </>
                                    )}
                                    {!cleanWaveformReady && (
                                        <div className="audio-waveform-placeholder">
                                            <div className="audio-waveform-skeleton">
                                                <div className="skeleton-line"></div>
                                                <div className="skeleton-line" style={{ width: '70%' }}></div>
                                                <div className="skeleton-line" style={{ width: '85%' }}></div>
                                            </div>
                                            <div className="audio-waveform-bubbles">
                                                <span className="wave-bubble"></span>
                                                <span className="wave-bubble"></span>
                                                <span className="wave-bubble"></span>
                                                <span className="wave-bubble"></span>
                                            </div>
                                            <span className="audio-waveform-label">Rendering waveform...</span>
                                        </div>
                                    )}
                                </div>

                                {compareEnabled && (
                                    <div className="compare-slider">
                                        <span className="compare-label">Original</span>
                                        <input
                                            type="range"
                                            min={10}
                                            max={90}
                                            value={comparePosition}
                                            onChange={(event) => setComparePosition(Number(event.target.value))}
                                        />
                                        <span className="compare-label">Sanitized</span>
                                    </div>
                                )}

                                <audio
                                    ref={cleanAudioRef}
                                    className="audio-player"
                                    controls
                                    preload="metadata"
                                    onPlay={handleSanitizedPlay}
                                >
                                    <source src={getArtifactUrl(cleanPath)} type="audio/wav" />
                                    Your browser does not support the audio element.
                                </audio>
                                {compareEnabled && (
                                    <div className="text-xs text-slate-500 mt-2">
                                        A/B preview: playing starts with 2s of original, then sanitized.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>
                                    Progress
                                    <span className="help-tip" data-tip="Step progress based on current run state.">?</span>
                                </span>
                                <span>{sanitizeProgressValue}%</span>
                            </div>
                            <div className="progress-track">
                                <div
                                    className={progressClass(sanitizeState.status)}
                                    style={{ width: `${sanitizeProgressValue}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="log-panel" ref={sanitizeLogRef}>
                            {sanitizeState.log && sanitizeState.log.length > 0 ? (
                                sanitizeState.log.map((line, idx) => (
                                    <div key={`sanitize-${idx}`} className="log-line">
                                        {line}
                                    </div>
                                ))
                            ) : sanitizeState.status === 'error' ? (
                                <div className="log-line text-red-400">
                                    {sanitizeState.message || 'Sanitize failed.'}
                                </div>
                            ) : sanitizeState.status === 'running' ? (
                                <div className="log-line text-slate-500">Streaming sanitize logs...</div>
                            ) : (
                                <div className="log-line text-slate-500">Waiting for sanitize logs...</div>
                            )}
                        </div>

                        {sanitizeSuggestion && (
                            <div className="review-suggest p-4 rounded-lg">
                                <div className="text-sm font-semibold text-amber-300 mb-1">
                                    {sanitizeSuggestion.title}
                                </div>
                                <div className="text-xs text-slate-300 mb-3">
                                    {sanitizeSuggestion.reason}
                                </div>
                                <div className="text-xs text-slate-400 mb-3">
                                    <strong>Suggested settings:</strong> {sanitizeSuggestion.settings.preset} preset,
                                    strictness {sanitizeSuggestion.settings.strictness},
                                    UVR {sanitizeSuggestion.settings.extractVocals ? 'ON' : 'OFF'}
                                </div>
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (suggestionRunning) return;
                                        setSuggestionRunning(true);
                                        setSanitizePreset(sanitizeSuggestion.settings.preset);
                                        setSanitizeStrictness(sanitizeSuggestion.settings.strictness);
                                        setSanitizeExtractVocals(sanitizeSuggestion.settings.extractVocals);
                                        await new Promise((resolve) => setTimeout(resolve, 100));
                                        try {
                                            await runSanitize();
                                        } finally {
                                            setSuggestionRunning(false);
                                        }
                                    }}
                                    disabled={suggestionRunning}
                                    className="primary-btn px-3 py-1.5 text-xs font-semibold rounded disabled:opacity-60"
                                >
                                    {suggestionRunning ? 'Running...' : 'Run suggested sanitize'}
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {showReview && (
                    <section ref={reviewRef} className="glass rounded-2xl p-6 space-y-3 step-reveal">
                        <h2 className="text-xl font-semibold text-white">
                            Step 4 - Review
                            <span className="help-tip" data-tip="Open the manual review page to accept/reject segments.">?</span>
                        </h2>
                        <p className="text-sm text-slate-400">
                            Manual edits will live on a separate page. This step unlocks once sanitize completes.
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setReviewOpen(true)}
                                className={`secondary-btn px-4 py-2 rounded-lg text-sm font-semibold ${stepStatus[3] === 'blocked' ? 'opacity-50 pointer-events-none' : ''
                                    }`}
                            >
                                Open Review
                            </button>
                            <span className="help-tip" data-tip="Launches the manual review workflow for this VOD.">?</span>
                            {stepStatus[3] === 'blocked' && (
                                <span className="text-xs text-slate-500">Run sanitize to unlock.</span>
                            )}
                        </div>
                    </section>
                )}

                {showSrt && (
                    <section ref={srtRef} className="glass rounded-2xl p-6 space-y-4 step-reveal">
                        <div>
                            <h2 className="text-xl font-semibold text-white">
                                Step 5 - Transcribe (SRT)
                                <span className="help-tip" data-tip="Runs faster-whisper to generate subtitles for dataset slicing.">?</span>
                            </h2>
                            <p className="text-sm text-slate-400">
                                Generate subtitles using faster-whisper.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={runSrt}
                                disabled={srtState.status === 'running' || stepStatus[4] === 'blocked'}
                                className="primary-btn px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60 transition-all"
                            >
                                {srtState.status === 'running' ? 'Transcribing...' : 'Run SRT'}
                            </button>
                            <span className="help-tip" data-tip="Creates an .srt file aligned to the VOD audio.">?</span>
                            {srtPath && (
                                <span className="text-sm output-glow mono">Output: {srtPath}</span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>
                                    Progress
                                    <span className="help-tip" data-tip="Step progress based on current run state.">?</span>
                                </span>
                                <span>{progressForStatus(srtState.status)}%</span>
                            </div>
                            <div className="progress-track">
                                <div
                                    className={progressClass(srtState.status)}
                                    style={{ width: `${progressForStatus(srtState.status)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="log-panel" ref={srtLogRef}>
                            {srtState.log && srtState.log.length > 0 ? (
                                srtState.log.map((line, idx) => (
                                    <div key={`srt-${idx}`} className="log-line">
                                        {line}
                                    </div>
                                ))
                            ) : (
                                <div className="log-line text-slate-500">Waiting for SRT logs...</div>
                            )}
                        </div>
                    </section>
                )}

                {showTrain && (
                    <section ref={trainRef} className="glass rounded-2xl p-6 space-y-4 step-reveal">
                        <div>
                            <h2 className="text-xl font-semibold text-white">
                                Step 6 - Train Dataset
                                <span className="help-tip" data-tip="Slices clean audio with the SRT to build a dataset.">?</span>
                            </h2>
                            <p className="text-sm text-slate-400">
                                Build the dataset from clean audio and SRT.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={runTrain}
                                disabled={trainState.status === 'running' || stepStatus[5] === 'blocked'}
                                className="primary-btn px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60 transition-all"
                            >
                                {trainState.status === 'running' ? 'Training...' : 'Run Train'}
                            </button>
                            <span className="help-tip" data-tip="Builds clips and manifests under the dataset folder.">?</span>
                            {datasetPath && (
                                <span className="text-sm output-glow mono">Output: {datasetPath}</span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>
                                    Progress
                                    <span className="help-tip" data-tip="Step progress based on current run state.">?</span>
                                </span>
                                <span>{progressForStatus(trainState.status)}%</span>
                            </div>
                            <div className="progress-track">
                                <div
                                    className={progressClass(trainState.status)}
                                    style={{ width: `${progressForStatus(trainState.status)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="log-panel" ref={trainLogRef}>
                            {trainState.log && trainState.log.length > 0 ? (
                                trainState.log.map((line, idx) => (
                                    <div key={`train-${idx}`} className="log-line">
                                        {line}
                                    </div>
                                ))
                            ) : (
                                <div className="log-line text-slate-500">Waiting for train logs...</div>
                            )}
                        </div>
                    </section>
                )}

                {showTts && (
                    <section ref={ttsRef} className="glass rounded-2xl p-6 space-y-4 step-reveal">
                        <div>
                            <h2 className="text-xl font-semibold text-white">
                                Step 7 - TTS
                                <span className="help-tip" data-tip="Generates a voice sample from your trained dataset.">?</span>
                            </h2>
                            <p className="text-sm text-slate-400">
                                Generate a test voice sample from the dataset.
                            </p>
                        </div>

                        <div>
                            <label className="text-sm text-slate-400">
                                Text
                                <span className="help-tip" data-tip="Phrase used to generate a test voice sample.">?</span>
                            </label>
                            <textarea
                                value={ttsText}
                                onChange={(event) => setTtsText(event.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={runTts}
                                disabled={ttsState.status === 'running' || stepStatus[6] === 'blocked'}
                                className="primary-btn px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60 transition-all"
                            >
                                {ttsState.status === 'running' ? 'Generating...' : 'Run TTS'}
                            </button>
                            <span className="help-tip" data-tip="Runs the XTTS script and writes a WAV output.">?</span>
                            {ttsPath && (
                                <span className="text-sm output-glow mono">Output: {ttsPath}</span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>
                                    Progress
                                    <span className="help-tip" data-tip="Step progress based on current run state.">?</span>
                                </span>
                                <span>{progressForStatus(ttsState.status)}%</span>
                            </div>
                            <div className="progress-track">
                                <div
                                    className={progressClass(ttsState.status)}
                                    style={{ width: `${progressForStatus(ttsState.status)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="log-panel" ref={ttsLogRef}>
                            {ttsState.log && ttsState.log.length > 0 ? (
                                ttsState.log.map((line, idx) => (
                                    <div key={`tts-${idx}`} className="log-line">
                                        {line}
                                    </div>
                                ))
                            ) : (
                                <div className="log-line text-slate-500">Waiting for TTS logs...</div>
                            )}
                        </div>
                    </section>
                )}
            </div>
            <div className="wizard-footer">
                <div className="wizard-footer-inner glass">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Overall progress</span>
                        <span>{pipelineProgress}%</span>
                    </div>
                    <div className="progress-track">
                        <div
                            className={progressClass('ready')}
                            style={{ width: `${pipelineProgress}%` }}
                        ></div>
                    </div>
                </div>
            </div>
            {activeRun && (
                <div className="run-window" role="status" aria-live="polite">
                    <div className="run-window-title">Running job</div>
                    <div className="run-window-step">{activeRun.label}</div>
                    <div className="run-window-actions">
                        <button
                            type="button"
                            onClick={handleStopActiveRun}
                            disabled={!canStopActive}
                            className="secondary-btn px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                        >
                            Stop
                        </button>
                        {!canStopActive && (
                            <span className="run-window-hint">Stop not available for this step yet.</span>
                        )}
                    </div>
                </div>
            )}
            {reviewOpen && (
                <div className="review-modal-overlay" role="dialog" aria-modal="true">
                    <div className="review-modal glass">
                        <div className="review-modal-header">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Manual Review</h2>
                                <p className="text-xs text-slate-400">Approve or reject sanitized segments.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewOpen(false)}
                                className="secondary-btn px-3 py-2 rounded-lg text-xs font-semibold"
                            >
                                Close
                            </button>
                        </div>
                        <div className="review-modal-body">
                            <ManualReviewPage vodUrlOverride={vodUrl} />
                        </div>
                    </div>
                </div>
            )}
            {jobPromptOpen && jobPromptJob && (
                <div className="job-modal-overlay" role="dialog" aria-modal="true">
                    <div className="job-modal glass">
                        <div className="job-modal-header">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Job already exists</h2>
                                <p className="text-xs text-slate-400">
                                    We found a cached run for this VOD. Continue or start over.
                                </p>
                            </div>
                        </div>
                        <div className="job-modal-body">
                            <div className="text-sm text-slate-300">
                                Job: <span className="mono text-emerald-300">{jobPromptJob.id}</span>
                            </div>
                            <div className="text-xs text-slate-500">Last update: {jobPromptJob.updatedAt}</div>
                        </div>
                        <div className="job-modal-actions">
                            <button
                                type="button"
                                onClick={handleJobContinue}
                                disabled={jobPromptBusy}
                                className="secondary-btn px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
                            >
                                Continue
                            </button>
                            <button
                                type="button"
                                onClick={handleJobStartOver}
                                disabled={jobPromptBusy}
                                className="primary-btn px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-60"
                            >
                                Start over (delete)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
