/**
 * Wizard Page
 * Simple guided flow for VOD -> Extract -> Sanitize -> Transcribe -> Train -> TTS
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ManualReviewPage } from '../manual-review/manual-review.page';
import { VodSearch, VodMetadataCard } from '../../features/vod-management';
import { useDependencies } from '../../context/dependency-context';
import { useAudioPlayer } from '../../context/audio-player.context';
import { useToast } from '../../shared/toast';
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
    runId?: string | null;
    audioPath?: string | null;
    sanitizePath?: string | null;
    srtPath?: string | null;
    datasetPath?: string | null;
    modelCheckpointPath?: string | null;
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

type DatasetRecord = {
    datasetId: string;
    streamer: string;
    runId?: string | null;
    datasetPath?: string | null;
    clipsCount?: number;
    hasTrainArtifacts?: boolean;
    createdAt?: string | null;
};

type RunKey = 'extract' | 'sanitize' | 'srt' | 'train' | 'modelTrain' | 'tts';

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
    const { showToast, removeToast } = useToast();
    const {
        src: globalAudioSrc,
        currentTime: globalAudioTime,
        duration: globalAudioDuration,
        isPlaying: globalAudioPlaying,
        playSegment,
        toggle,
        seek,
    } = useAudioPlayer();

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
    const [srtSpeed, setSrtSpeed] = useState<'accurate' | 'balanced' | 'fast'>('balanced');
    const [srtAcceptedOnly, setSrtAcceptedOnly] = useState(true);
    const [ttsSourceMode, setTtsSourceMode] = useState<'all_streamer' | 'target_dataset'>('all_streamer');
    const [ttsTargetDatasetPath, setTtsTargetDatasetPath] = useState<string>('');
    const [ttsQualityPreset, setTtsQualityPreset] = useState<'fast' | 'balanced' | 'best'>('balanced');
    const [ttsAcceptedOnly, setTtsAcceptedOnly] = useState(false);
    const [ttsDatasets, setTtsDatasets] = useState<DatasetRecord[]>([]);
    const [ttsDatasetsLoading, setTtsDatasetsLoading] = useState(false);
    const [ttsText, setTtsText] = useState('Sample line for TTS.');

    const [extractState, setExtractState] = useState<RunState>({ status: 'idle' });
    const [sanitizeState, setSanitizeState] = useState<RunState>({ status: 'idle' });
    const [srtState, setSrtState] = useState<RunState>({ status: 'idle' });
    const [trainState, setTrainState] = useState<RunState>({ status: 'idle' });
    const [modelTrainState, setModelTrainState] = useState<RunState>({ status: 'idle' });
    const [ttsState, setTtsState] = useState<RunState>({ status: 'idle' });
    const [sanitizeProgress, setSanitizeProgress] = useState<number | null>(null);
    const [extractProgress, setExtractProgress] = useState<number | null>(null);
    const [srtProgress, setSrtProgress] = useState<number | null>(null);
    const [trainProgress, setTrainProgress] = useState<number | null>(null);
    const [modelTrainProgress, setModelTrainProgress] = useState<number | null>(null);
    const [suggestionRunning, setSuggestionRunning] = useState(false);
    const [searchParams] = useSearchParams();

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
    const [modelCheckpointPath, setModelCheckpointPath] = useState<string | null>(null);
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

    useEffect(() => {
        if (!reviewOpen) {
            return;
        }
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [reviewOpen]);
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
    const extractLogRef = useRef<HTMLDivElement | null>(null);
    const sanitizeLogRef = useRef<HTMLDivElement | null>(null);
    const srtLogRef = useRef<HTMLDivElement | null>(null);
    const trainLogRef = useRef<HTMLDivElement | null>(null);
    const modelTrainLogRef = useRef<HTMLDivElement | null>(null);
    const ttsLogRef = useRef<HTMLDivElement | null>(null);
    const sanitizeAbortRef = useRef<AbortController | null>(null);
    const legacyJobRef = useRef<LegacyJob | null>(null);

    const extractRef = useRef<HTMLDivElement | null>(null);
    const sanitizeRef = useRef<HTMLDivElement | null>(null);
    const reviewRef = useRef<HTMLDivElement | null>(null);
    const srtRef = useRef<HTMLDivElement | null>(null);
    const trainRef = useRef<HTMLDivElement | null>(null);
    const modelTrainRef = useRef<HTMLDivElement | null>(null);
    const ttsRef = useRef<HTMLDivElement | null>(null);
    const revealStateRef = useRef({
        extract: false,
        sanitize: false,
        review: false,
        srt: false,
        train: false,
        modelTrain: false,
        tts: false,
    });
    const runningToastIdsRef = useRef<Set<string>>(new Set());

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
        const match = line.match(/(\d{1,3}(?:\.\d+)?)%/);
        if (!match) return null;
        const value = Number(match[1]);
        if (!Number.isFinite(value) || value < 0 || value > 100) return null;
        return Math.round(value);
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
        setModelTrainState({ status: 'idle' });
        setTtsState({ status: 'idle' });
        setSanitizeProgress(null);
        setExtractProgress(null);
        setSrtProgress(null);
        setTrainProgress(null);
        setModelTrainProgress(null);
        setAudioPath(null);
        setCleanPath(null);
        setSrtPath(null);
        setDatasetPath(null);
        setModelCheckpointPath(null);
        setTtsPath(null);
    }, []);

    const resetRevealState = useCallback(() => {
        revealStateRef.current = {
            extract: false,
            sanitize: false,
            review: false,
            srt: false,
            train: false,
            modelTrain: false,
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
        setModelCheckpointPath(outputs.modelCheckpointPath ?? null);
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
        setSrtProgress(job.steps.srt ? 100 : null);
        setTrainState(
            job.steps.train
                ? { status: 'done', message: 'Dataset ready', outputPath: outputs.datasetPath ?? undefined }
                : { status: 'idle' }
        );
        setModelTrainState(
            outputs.modelCheckpointPath
                ? { status: 'done', message: 'Model checkpoint ready', outputPath: outputs.modelCheckpointPath ?? undefined }
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

    const extractedPreviewSrc = useMemo(() => (audioPath ? getArtifactUrl(audioPath) : null), [audioPath, getArtifactUrl]);
    const sanitizedPreviewSrc = useMemo(() => (cleanPath ? getArtifactUrl(cleanPath) : null), [cleanPath, getArtifactUrl]);
    const sanitizePlaylist = useMemo(() => {
        const items: Array<{ id: number; src: string; label: string }> = [];
        if (extractedPreviewSrc) {
            items.push({ id: 1, src: extractedPreviewSrc, label: 'Sanitize: Original preview' });
        }
        if (sanitizedPreviewSrc) {
            items.push({ id: 2, src: sanitizedPreviewSrc, label: 'Sanitize: Sanitized preview' });
        }
        return items;
    }, [extractedPreviewSrc, sanitizedPreviewSrc]);

    const formatAudioTime = useCallback((seconds: number) => {
        if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, []);

    const ensureGlobalPreviewSource = useCallback(async (
        source: string | null,
        startAt?: number,
        autoplay = true
    ) => {
        if (!source) return;
        const segmentId = source === sanitizedPreviewSrc ? 2 : 1;
        await playSegment({
            context: 'sanitize',
            playlist: sanitizePlaylist,
            segmentId,
            autoplay,
            startAt: Number.isFinite(startAt as number) ? startAt : undefined,
        });
    }, [playSegment, sanitizePlaylist, sanitizedPreviewSrc]);

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
        scrollLogToEnd(modelTrainLogRef.current);
    }, [modelTrainState.log?.length]);

    useEffect(() => {
        scrollLogToEnd(ttsLogRef.current);
    }, [ttsState.log?.length]);

    useEffect(() => {
        let frameId = 0;

        const updateCursor = (
            source: string | null,
            shell: HTMLDivElement | null,
            cursor: HTMLDivElement | null
        ) => {
            if (!source || !shell || !cursor) return;
            const isActive = globalAudioSrc === source;
            const duration = isActive ? globalAudioDuration : 0;
            const current = isActive ? globalAudioTime : 0;
            const ratio = duration > 0 ? current / duration : 0;
            const width = shell.clientWidth || 1;
            cursor.style.transform = `translateX(${Math.max(0, Math.min(width, ratio * width))}px)`;
        };

        const tick = () => {
            updateCursor(extractedPreviewSrc, waveformShellRef.current, cursorRef.current);
            updateCursor(sanitizedPreviewSrc, cleanWaveformShellRef.current, cleanCursorRef.current);
            updateCursor(sanitizedPreviewSrc, compareShellRef.current, compareCursorRef.current);
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, [waveformReady, cleanWaveformReady, extractedPreviewSrc, sanitizedPreviewSrc, globalAudioSrc, globalAudioDuration, globalAudioTime]);

    const handleWaveformSeek = (
        event: React.MouseEvent<HTMLDivElement>,
        source: string | null,
        shell: HTMLDivElement | null
    ): void => {
        if (!source || !shell) return;
        const rect = shell.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
        const baseDuration = globalAudioSrc === source ? globalAudioDuration : 0;
        const targetTime = baseDuration > 0 ? baseDuration * ratio : 0;
        if (globalAudioSrc !== source) {
            void ensureGlobalPreviewSource(source, targetTime, true);
            return;
        }
        seek(targetTime);
    };

    const handlePreviewToggle = useCallback((source: string | null) => {
        if (!source) return;
        if (globalAudioSrc !== source) {
            void ensureGlobalPreviewSource(source, 0, true);
            return;
        }
        void toggle();
    }, [globalAudioSrc, ensureGlobalPreviewSource, toggle]);

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
            // DEV easter egg: 'dev' translates to development VOD
            let actualVodUrl = vodInput.trim();
            if (actualVodUrl.toLowerCase() === 'dev') {
                actualVodUrl = 'https://www.twitch.tv/videos/2453173157';
            }

            const parsed = parseVodUrl(actualVodUrl);
            if (!parsed) {
                setVodInvalid(true);
                applyLegacyJob(null);
                return;
            }

            setVodInvalid(false);
            resetRevealState();
            setVodUrl(actualVodUrl);
            resetMetadata();
            await fetchMetadata(parsed.vodId, parsed.platform);
            await loadLegacyJob(actualVodUrl);
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

    useEffect(() => {
        const streamer = metadata?.streamer?.trim().toLowerCase();
        if (!streamer) {
            setTtsDatasets([]);
            setTtsTargetDatasetPath('');
            return;
        }

        let cancelled = false;
        const loadDatasets = async () => {
            setTtsDatasetsLoading(true);
            try {
                const payload = await legacyGet<{ items: DatasetRecord[] }>(`/datasets?streamer=${encodeURIComponent(streamer)}`);
                if (cancelled) return;
                const items = (payload.items || []).filter((item) => item.datasetPath);
                setTtsDatasets(items);
                if (!ttsTargetDatasetPath && items.length > 0) {
                    const preferred = items.find((item) => item.hasTrainArtifacts) ?? items[0];
                    setTtsTargetDatasetPath(preferred.datasetPath || '');
                }
            } catch {
                if (!cancelled) {
                    setTtsDatasets([]);
                }
            } finally {
                if (!cancelled) {
                    setTtsDatasetsLoading(false);
                }
            }
        };

        void loadDatasets();
        return () => {
            cancelled = true;
        };
    }, [metadata?.streamer, legacyGet, ttsTargetDatasetPath]);

    useEffect(() => {
        const resumeJobId = searchParams.get('jobId')?.trim();
        if (!resumeJobId) {
            return;
        }

        let cancelled = false;

        const loadJobById = async () => {
            try {
                const job = await legacyGet<LegacyJob>(`/jobs/${encodeURIComponent(resumeJobId)}`);
                if (cancelled) return;

                setVodInput(job.vodUrl);
                setVodUrl(job.vodUrl);
                applyLegacyJob(job);

                const parsed = parseVodUrl(job.vodUrl);
                if (parsed) {
                    await fetchMetadata(parsed.vodId, parsed.platform);
                }
            } catch (error) {
                if (cancelled) return;
                setLegacyJobError((error as Error).message);
            }
        };

        void loadJobById();

        return () => {
            cancelled = true;
        };
    }, [searchParams, legacyGet, applyLegacyJob, fetchMetadata]);

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
        const job = await ensureLegacyJob();
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
                    runId: job?.outputs?.runId ?? undefined,
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
                    runId: job?.outputs?.runId ?? undefined,
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
        const job = await ensureLegacyJob();
        setSrtState({ status: 'running', message: 'Transcribing...', log: [] });
        setSrtProgress(5);
        try {
            const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/legacy/srt/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vodUrl,
                    stream: true,
                    speed: srtSpeed,
                    acceptedOnly: srtAcceptedOnly,
                    runId: job?.outputs?.runId ?? undefined,
                }),
            });

            if (!response.ok || !response.body) {
                const payload = await response.json().catch(() => ({}));
                const detail = (payload as { detail?: string }).detail || response.statusText;
                throw new Error(detail);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let doneReceived = false;

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
                        type: 'log' | 'done' | 'error';
                        line?: string;
                        error?: string;
                        result?: {
                            path: string;
                            lines: number;
                            excerpt: string;
                            exitCode: number;
                        };
                    };

                    if (evt.type === 'log' && evt.line) {
                        const parsed = parseProgressFromLog(evt.line);
                        setSrtProgress((prev) => {
                            if (parsed !== null) {
                                return Math.min(parsed, 95);
                            }
                            const seed = prev ?? 5;
                            return Math.min(seed + 3, 95);
                        });
                        setSrtState((prev) => ({
                            ...prev,
                            log: appendLog(prev.log, evt.line as string),
                        }));
                    }

                    if (evt.type === 'error') {
                        doneReceived = true;
                        setSrtProgress(null);
                        setSrtState((prev) => ({
                            status: 'error',
                            message: evt.error || 'SRT failed',
                            log: appendLog(prev.log, evt.error || 'SRT failed'),
                        }));
                    }

                    if (evt.type === 'done' && evt.result) {
                        doneReceived = true;
                        setSrtPath(evt.result.path);
                        setSrtProgress(100);
                        setSrtState((prev) => ({
                            status: 'done',
                            message: `SRT generated (${evt.result.lines} lines)`,
                            log: appendLog(prev.log, `[done] Subtitle lines: ${evt.result.lines}`),
                            outputPath: evt.result.path,
                        }));
                        setTrainState({ status: 'ready' });
                        await updateLegacyJob({ srt: true }, { srtPath: evt.result.path });
                    }
                }
            }

            if (!doneReceived) {
                throw new Error('SRT stream ended without completion event');
            }
        } catch (error) {
            setSrtProgress(null);
            setSrtState((prev) => ({
                status: 'error',
                message: (error as Error).message,
                log: appendLog(prev.log, (error as Error).message),
            }));
        }
    };

    const runTrain = async (): Promise<void> => {
        if (!vodUrl.trim()) return;
        const job = await ensureLegacyJob();
        setTrainState({ status: 'running', message: 'Building dataset...', log: [] });
        setTrainProgress(5);
        try {
            const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/legacy/dataset/build`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vodUrl, stream: true, runId: job?.outputs?.runId ?? undefined }),
            });

            if (!response.ok || !response.body) {
                const payload = await response.json().catch(() => ({}));
                const detail = (payload as { detail?: string }).detail || response.statusText;
                throw new Error(detail);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let doneReceived = false;

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
                        type: 'log' | 'done' | 'error';
                        line?: string;
                        error?: string;
                        result?: {
                            datasetPath: string;
                            clipsDir: string;
                            manifestPath: string;
                            segmentsPath: string;
                            exitCode: number;
                            log: string[];
                        };
                    };

                    if (evt.type === 'log' && evt.line) {
                        const parsed = parseProgressFromLog(evt.line);
                        setTrainProgress((prev) => {
                            if (parsed !== null) return Math.min(parsed, 95);
                            const seed = prev ?? 5;
                            return Math.min(seed + 2, 95);
                        });
                        setTrainState((prev) => ({
                            ...prev,
                            log: appendLog(prev.log, evt.line as string),
                        }));
                    }

                    if (evt.type === 'error') {
                        doneReceived = true;
                        setTrainProgress(null);
                        setTrainState((prev) => ({
                            status: 'error',
                            message: evt.error || 'Dataset build failed',
                            log: appendLog(prev.log, evt.error || 'Dataset build failed'),
                        }));
                    }

                    if (evt.type === 'done' && evt.result) {
                        doneReceived = true;
                        setDatasetPath(evt.result.datasetPath);
                        setTrainProgress(100);
                        setTrainState((prev) => ({
                            status: 'done',
                            message: 'Dataset ready',
                            log: (evt.result?.log ?? prev.log ?? []).slice(-MAX_LOG_LINES),
                            outputPath: evt.result.datasetPath,
                        }));
                        setModelTrainState({ status: 'ready' });
                        await updateLegacyJob({ train: true }, { datasetPath: evt.result.datasetPath });
                    }
                }
            }

            if (!doneReceived) {
                throw new Error('Dataset build stream ended without completion event');
            }
        } catch (error) {
            setTrainProgress(null);
            setTrainState((prev) => ({
                status: 'error',
                message: (error as Error).message,
                log: appendLog(prev.log, (error as Error).message),
            }));
        }
    };

    const runModelTrain = async (): Promise<void> => {
        if (!vodUrl.trim()) return;
        const job = await ensureLegacyJob();
        const runId = job?.outputs?.runId;
        if (!runId) {
            setModelTrainState({ status: 'error', message: 'runId missing for model training' });
            return;
        }

        setModelTrainState({ status: 'running', message: 'Training model checkpoint...', log: [] });
        setModelTrainProgress(5);

        try {
            const start = await legacyPost<{
                jobId: string;
                checkpointId: string;
                checkpointPath: string;
                metadataPath: string;
                status: string;
            }>('/model/train', {
                vodUrl,
                runId,
                epochs: 1,
                baseModel: 'xtts_v2',
            });

            setModelTrainState((prev) => ({
                ...prev,
                log: appendLog(prev.log, `[queue] ${start.jobId}`),
            }));

            const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
            let finished = false;
            while (!finished) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                const response = await fetch(`${baseUrl}/legacy/model/train/jobs/${encodeURIComponent(start.jobId)}`);
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error((payload as { detail?: string }).detail || response.statusText);
                }

                const status = String((payload as { status?: string }).status || 'queued');
                const progress = Number((payload as { progress?: number }).progress || 0);
                setModelTrainProgress(Math.max(5, Math.min(100, progress)));

                const logs = Array.isArray((payload as { log?: string[] }).log) ? (payload as { log?: string[] }).log || [] : [];
                setModelTrainState((prev) => ({
                    ...prev,
                    log: logs.slice(-MAX_LOG_LINES),
                    message: `Model Train: ${status}`,
                }));

                if (status === 'done') {
                    finished = true;
                    const checkpointPath = String((payload as { checkpointPath?: string }).checkpointPath || start.checkpointPath);
                    setModelCheckpointPath(checkpointPath);
                    setModelTrainProgress(100);
                    setModelTrainState((prev) => ({
                        ...prev,
                        status: 'done',
                        message: 'Model checkpoint ready',
                        outputPath: checkpointPath,
                    }));
                    setTtsState({ status: 'ready' });
                    await updateLegacyJob({}, { modelCheckpointPath: checkpointPath });
                } else if (status === 'failed' || status === 'canceled') {
                    finished = true;
                    const errorText = String((payload as { error?: string }).error || `Model train ${status}`);
                    setModelTrainProgress(null);
                    setModelTrainState((prev) => ({
                        ...prev,
                        status: 'error',
                        message: errorText,
                        log: appendLog(prev.log, errorText),
                    }));
                }
            }
        } catch (error) {
            setModelTrainProgress(null);
            setModelTrainState((prev) => ({
                status: 'error',
                message: (error as Error).message,
                log: appendLog(prev.log, (error as Error).message),
            }));
        }
    };

    const runTts = async (): Promise<void> => {
        if (!vodUrl.trim() || !metadata) return;
        const job = await ensureLegacyJob();
        setTtsState({ status: 'running', message: 'Generating TTS...' });
        try {
            const result = await legacyPost<{ outputPath: string; log: string[] }>(
                '/tts/run',
                {
                    vodUrl,
                    streamer: metadata.streamer,
                    text: ttsText,
                    sourceMode: ttsSourceMode,
                    targetDatasetPath: ttsSourceMode === 'target_dataset' ? ttsTargetDatasetPath || undefined : undefined,
                    qualityPreset: ttsQualityPreset,
                    acceptedOnly: ttsAcceptedOnly,
                    runId: job?.outputs?.runId ?? undefined,
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
            const errorMessage = (error as Error).message;
            setTtsState({
                status: 'error',
                message: errorMessage,
                log: [
                    `[${new Date().toLocaleTimeString()}] TTS failed`,
                    `[${new Date().toLocaleTimeString()}] ${errorMessage}`,
                ],
            });
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
        const modelTrainStep: StepStatus =
            modelTrainState.status === 'idle'
                ? trainState.status === 'done'
                    ? 'ready'
                    : 'blocked'
                : modelTrainState.status;
        const ttsStep: StepStatus =
            ttsState.status === 'idle'
                ? modelTrainState.status === 'done'
                    ? 'ready'
                    : 'blocked'
                : ttsState.status;

        return [vodStep, extractStep, sanitizeStep, reviewStep, srtStep, trainStep, modelTrainStep, ttsStep];
    }, [metadata, legacyJob, extractState, sanitizeState, srtState, trainState, modelTrainState, ttsState]);

    const pipelineProgress = useMemo(
        () => overallProgressForSteps([
            { status: extractState.status },
            { status: sanitizeState.status, progress: sanitizeProgress },
            { status: srtState.status, progress: srtProgress },
            { status: trainState.status, progress: trainProgress },
            { status: modelTrainState.status, progress: modelTrainProgress },
            { status: ttsState.status },
        ]),
        [extractState.status, sanitizeState.status, srtState.status, trainState.status, modelTrainState.status, ttsState.status, sanitizeProgress, srtProgress, trainProgress, modelTrainProgress]
    );

    const sanitizeProgressValue = useMemo(
        () => progressValueForStep(sanitizeState.status, sanitizeProgress),
        [sanitizeState.status, sanitizeProgress]
    );

    const extractProgressValue = useMemo(
        () => progressValueForStep(extractState.status, extractProgress),
        [extractState.status, extractProgress]
    );

    const srtProgressValue = useMemo(
        () => progressValueForStep(srtState.status, srtProgress),
        [srtState.status, srtProgress]
    );

    const trainProgressValue = useMemo(
        () => progressValueForStep(trainState.status, trainProgress),
        [trainState.status, trainProgress]
    );

    const modelTrainProgressValue = useMemo(
        () => progressValueForStep(modelTrainState.status, modelTrainProgress),
        [modelTrainState.status, modelTrainProgress]
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

    const scrollToStep = useCallback((key: RunKey) => {
        const refMap: Record<RunKey, React.RefObject<HTMLDivElement | null>> = {
            extract: extractRef,
            sanitize: sanitizeRef,
            srt: srtRef,
            train: trainRef,
            modelTrain: modelTrainRef,
            tts: ttsRef,
        };
        refMap[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const runningJobs = useMemo(() => {
        const jobs: Array<{ key: RunKey; label: string; running: boolean }> = [
            { key: 'extract', label: 'Extract audio', running: extractState.status === 'running' },
            { key: 'sanitize', label: 'Sanitize audio', running: sanitizeState.status === 'running' },
            { key: 'srt', label: 'Transcribe (SRT)', running: srtState.status === 'running' },
            { key: 'train', label: 'Dataset Build', running: trainState.status === 'running' },
            { key: 'modelTrain', label: 'Model Train', running: modelTrainState.status === 'running' },
            { key: 'tts', label: 'Generate TTS', running: ttsState.status === 'running' },
        ];
        return jobs;
    }, [extractState.status, sanitizeState.status, srtState.status, trainState.status, modelTrainState.status, ttsState.status]);

    useEffect(() => {
        const visibleRunningToastIds = new Set<string>();

        runningJobs.forEach((job) => {
            const toastId = `wizard-running-${job.key}`;
            if (job.running) {
                visibleRunningToastIds.add(toastId);
                showToast('info', `Running: ${job.label}`, 0, {
                    id: toastId,
                    busy: true,
                    onClick: () => scrollToStep(job.key),
                });
            } else {
                removeToast(toastId);
            }
        });

        runningToastIdsRef.current.forEach((toastId) => {
            if (!visibleRunningToastIds.has(toastId)) {
                removeToast(toastId);
            }
        });

        runningToastIdsRef.current = visibleRunningToastIds;
    }, [runningJobs, showToast, removeToast, scrollToStep]);

    useEffect(() => {
        return () => {
            runningToastIdsRef.current.forEach((toastId) => removeToast(toastId));
            runningToastIdsRef.current.clear();
        };
    }, [removeToast]);

    const showExtract = Boolean(legacyJob);
    const showSanitize = extractState.status === 'done';
    const showReview = sanitizeState.status === 'done';
    const showSrt = sanitizeState.status === 'done';
    const showTrain = srtState.status === 'done';
    const showModelTrain = trainState.status === 'done';
    const showTts = modelTrainState.status === 'done';

    useEffect(() => {
        const steps = [
            { key: 'extract', visible: showExtract, ref: extractRef },
            { key: 'sanitize', visible: showSanitize, ref: sanitizeRef },
            { key: 'review', visible: showReview, ref: reviewRef },
            { key: 'srt', visible: showSrt, ref: srtRef },
            { key: 'train', visible: showTrain, ref: trainRef },
            { key: 'modelTrain', visible: showModelTrain, ref: modelTrainRef },
            { key: 'tts', visible: showTts, ref: ttsRef },
        ] as const;

        steps.forEach((step) => {
            const previous = revealStateRef.current[step.key];
            if (step.visible && !previous) {
                step.ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            revealStateRef.current[step.key] = step.visible;
        });
    }, [showExtract, showSanitize, showReview, showSrt, showTrain, showModelTrain, showTts]);

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
                                Validate, extract, sanitize, review, transcribe, build dataset, train model, and generate TTS.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button className="primary-btn px-5 py-3 rounded-xl text-sm font-semibold transition-all">
                                Start new run
                            </button>
                            <Link to="/jobs" className="secondary-btn px-5 py-3 rounded-xl text-sm font-semibold transition-all inline-flex items-center">
                                See recent jobs
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-8 float-in">
                    {[
                        'VOD',
                        'Extract',
                        'Sanitize',
                        'Review',
                        'SRT',
                        'Dataset Build',
                        'Model Train',
                        'TTS Generate',
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
                            'Dataset Build',
                            'Model Train',
                            'TTS Generate',
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
                                    <li><strong>Dataset Build:</strong> Build immutable run clips from sanitize + review + ASR.</li>
                                    <li><strong>Model Train:</strong> Queue fine-tune/checkpoint training job.</li>
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
                        Paste a Twitch or YouTube VOD URL to fetch metadata. Tip: type 'dev' for quick testing.
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
                                    <p className="text-xs text-slate-400">Paste a Twitch or YouTube VOD URL. Tip: type 'dev' for quick testing.</p>
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
                                    onClick={(event) => handleWaveformSeek(event, extractedPreviewSrc, waveformShellRef.current)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            handleWaveformSeek(
                                                event as unknown as React.MouseEvent<HTMLDivElement>,
                                                extractedPreviewSrc,
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
                                <div className="inline-global-player-controls">
                                    <button
                                        type="button"
                                        className="secondary-btn px-3 py-2 rounded-lg text-xs font-semibold"
                                        onClick={() => handlePreviewToggle(extractedPreviewSrc)}
                                    >
                                        {globalAudioSrc === extractedPreviewSrc && globalAudioPlaying ? 'Pause' : 'Play'}
                                    </button>
                                    <input
                                        type="range"
                                        min={0}
                                        max={Math.max(globalAudioSrc === extractedPreviewSrc ? globalAudioDuration : 0, 1)}
                                        step={0.1}
                                        value={globalAudioSrc === extractedPreviewSrc ? globalAudioTime : 0}
                                        onChange={(event) => {
                                            const value = Number(event.target.value);
                                            if (globalAudioSrc !== extractedPreviewSrc) {
                                                void ensureGlobalPreviewSource(extractedPreviewSrc, value, false);
                                                return;
                                            }
                                            seek(value);
                                        }}
                                    />
                                    <span className="inline-global-time">
                                        {formatAudioTime(globalAudioSrc === extractedPreviewSrc ? globalAudioTime : 0)} / {formatAudioTime(globalAudioSrc === extractedPreviewSrc ? globalAudioDuration : 0)}
                                    </span>
                                </div>
                                <audio ref={audioRef} preload="metadata" style={{ display: 'none' }}>
                                    <source src={getArtifactUrl(audioPath)} type="audio/wav" />
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
                                            sanitizedPreviewSrc,
                                            compareEnabled ? compareShellRef.current : cleanWaveformShellRef.current
                                        )
                                    }
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            handleWaveformSeek(
                                                event as unknown as React.MouseEvent<HTMLDivElement>,
                                                sanitizedPreviewSrc,
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

                                <div className="inline-global-player-controls">
                                    <button
                                        type="button"
                                        className="secondary-btn px-3 py-2 rounded-lg text-xs font-semibold"
                                        onClick={() => handlePreviewToggle(sanitizedPreviewSrc)}
                                    >
                                        {globalAudioSrc === sanitizedPreviewSrc && globalAudioPlaying ? 'Pause' : 'Play'}
                                    </button>
                                    <input
                                        type="range"
                                        min={0}
                                        max={Math.max(globalAudioSrc === sanitizedPreviewSrc ? globalAudioDuration : 0, 1)}
                                        step={0.1}
                                        value={globalAudioSrc === sanitizedPreviewSrc ? globalAudioTime : 0}
                                        onChange={(event) => {
                                            const value = Number(event.target.value);
                                            if (globalAudioSrc !== sanitizedPreviewSrc) {
                                                void ensureGlobalPreviewSource(sanitizedPreviewSrc, value, false);
                                                return;
                                            }
                                            seek(value);
                                        }}
                                    />
                                    <span className="inline-global-time">
                                        {formatAudioTime(globalAudioSrc === sanitizedPreviewSrc ? globalAudioTime : 0)} / {formatAudioTime(globalAudioSrc === sanitizedPreviewSrc ? globalAudioDuration : 0)}
                                    </span>
                                </div>
                                <audio
                                    ref={cleanAudioRef}
                                    preload="metadata"
                                    style={{ display: 'none' }}
                                >
                                    <source src={getArtifactUrl(cleanPath)} type="audio/wav" />
                                </audio>
                                {compareEnabled && (
                                    <div className="text-xs text-slate-500 mt-2">
                                        Compare mode overlays waveforms; playback uses global player to avoid parallel audio.
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

                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <label className="text-sm text-slate-400">
                                    Speed
                                    <span className="help-tip" data-tip="Fast = quickest, Accurate = best quality, Balanced = default.">?</span>
                                </label>
                                <select
                                    value={srtSpeed}
                                    onChange={(event) => setSrtSpeed(event.target.value as 'accurate' | 'balanced' | 'fast')}
                                    disabled={srtState.status === 'running'}
                                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white disabled:opacity-60"
                                >
                                    <option value="fast">Fast</option>
                                    <option value="balanced">Balanced</option>
                                    <option value="accurate">Accurate</option>
                                </select>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-300 md:pt-7">
                                <input
                                    type="checkbox"
                                    checked={srtAcceptedOnly}
                                    onChange={(event) => setSrtAcceptedOnly(event.target.checked)}
                                    disabled={srtState.status === 'running'}
                                />
                                Use accepted regions only
                                <span className="help-tip" data-tip="Transcribe only kept/review-accepted sanitize regions.">?</span>
                            </label>
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
                                <span>{srtProgressValue}%</span>
                            </div>
                            <div className="progress-track">
                                <div
                                    className={progressClass(srtState.status)}
                                    style={{ width: `${srtProgressValue}%` }}
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
                                Step 6 - Dataset Build
                                <span className="help-tip" data-tip="Builds immutable run dataset from sanitize + review + ASR overlap.">?</span>
                            </h2>
                            <p className="text-sm text-slate-400">
                                Build the dataset artifacts for this run.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={runTrain}
                                disabled={trainState.status === 'running' || stepStatus[5] === 'blocked'}
                                className="primary-btn px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60 transition-all"
                            >
                                {trainState.status === 'running' ? 'Building...' : 'Run Dataset Build'}
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
                                <span>{trainProgressValue}%</span>
                            </div>
                            <div className="progress-track">
                                <div
                                    className={progressClass(trainState.status)}
                                    style={{ width: `${trainProgressValue}%` }}
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
                                <div className="log-line text-slate-500">Waiting for dataset build logs...</div>
                            )}
                        </div>
                    </section>
                )}

                {showModelTrain && (
                    <section ref={modelTrainRef} className="glass rounded-2xl p-6 space-y-4 step-reveal">
                        <div>
                            <h2 className="text-xl font-semibold text-white">
                                Step 7 - Model Train
                                <span className="help-tip" data-tip="Queues fine-tune/checkpoint training for this run dataset.">?</span>
                            </h2>
                            <p className="text-sm text-slate-400">
                                Train a checkpoint artifact for this streamer and run.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={runModelTrain}
                                disabled={modelTrainState.status === 'running' || stepStatus[6] === 'blocked'}
                                className="primary-btn px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60 transition-all"
                            >
                                {modelTrainState.status === 'running' ? 'Training model...' : 'Run Model Train'}
                            </button>
                            <span className="help-tip" data-tip="Creates checkpoint metadata and weight artifacts under models/<streamer>/<checkpointId>.">?</span>
                            {modelCheckpointPath && (
                                <span className="text-sm output-glow mono">Output: {modelCheckpointPath}</span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs text-slate-500">
                                <span>Progress</span>
                                <span>{modelTrainProgressValue}%</span>
                            </div>
                            <div className="progress-track">
                                <div
                                    className={progressClass(modelTrainState.status)}
                                    style={{ width: `${modelTrainProgressValue}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="log-panel" ref={modelTrainLogRef}>
                            {modelTrainState.log && modelTrainState.log.length > 0 ? (
                                modelTrainState.log.map((line, idx) => (
                                    <div key={`model-train-${idx}`} className="log-line">
                                        {line}
                                    </div>
                                ))
                            ) : (
                                <div className="log-line text-slate-500">Waiting for model train logs...</div>
                            )}
                        </div>
                    </section>
                )}

                {showTts && (
                    <section ref={ttsRef} className="glass rounded-2xl p-6 space-y-4 step-reveal">
                        <div>
                            <h2 className="text-xl font-semibold text-white">
                                Step 8 - TTS Generate
                                <span className="help-tip" data-tip="Generates a voice sample from your trained dataset.">?</span>
                            </h2>
                            <p className="text-sm text-slate-400">
                                Generate a test voice sample from prepared dataset clips (XTTS speaker conditioning).
                            </p>
                        </div>

                        <div className="space-y-2 rounded-lg border border-white/10 p-3">
                            <label className="flex items-center gap-2 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={ttsSourceMode === 'target_dataset'}
                                    onChange={(event) => setTtsSourceMode(event.target.checked ? 'target_dataset' : 'all_streamer')}
                                />
                                Use particular dataset
                            </label>
                            {ttsSourceMode === 'target_dataset' ? (
                                <div>
                                    <label className="text-xs text-slate-400">Dataset / Run</label>
                                    <select
                                        value={ttsTargetDatasetPath}
                                        onChange={(event) => setTtsTargetDatasetPath(event.target.value)}
                                        className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
                                    >
                                        {ttsDatasets.length === 0 ? (
                                            <option value="">{ttsDatasetsLoading ? 'Loading datasets...' : 'No datasets found'}</option>
                                        ) : (
                                            ttsDatasets.map((item) => (
                                                <option key={item.datasetId} value={item.datasetPath || ''}>
                                                    {(item.runId ? `Run ${item.runId}` : 'Legacy dataset')} • {item.clipsCount ?? 0} clips
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400">
                                    Default mode uses all available artifacts for this streamer.
                                </p>
                            )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                            <div>
                                <label className="text-sm text-slate-400">
                                    Quality Preset
                                    <span className="help-tip" data-tip="Fast uses fewer clips, Best uses the largest clip pool for highest quality.">?</span>
                                </label>
                                <select
                                    value={ttsQualityPreset}
                                    onChange={(event) => setTtsQualityPreset(event.target.value as 'fast' | 'balanced' | 'best')}
                                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
                                >
                                    <option value="fast">Fast</option>
                                    <option value="balanced">Balanced</option>
                                    <option value="best">Best</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2 pt-6 text-sm text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={ttsAcceptedOnly}
                                    onChange={(event) => setTtsAcceptedOnly(event.target.checked)}
                                />
                                Use accepted-only clips when available
                            </div>
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
                                disabled={ttsState.status === 'running' || stepStatus[7] === 'blocked'}
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
                            ) : ttsState.status === 'error' ? (
                                <div className="log-line text-red-400">{ttsState.message || 'TTS failed.'}</div>
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
                            <ManualReviewPage
                                vodUrlOverride={vodUrl}
                                runIdOverride={legacyJob?.outputs?.runId ?? undefined}
                            />
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
