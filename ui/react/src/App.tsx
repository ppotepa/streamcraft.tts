import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApi, ExportClipItem, SanitizeResult, SegmentPreview, SegmentReviewVote, VodMeta, WizardApi } from './api/client';

const steps: StepDefinition[] = [
    { id: 'vod', title: 'VOD', sub: 'Metadata + preview' },
    { id: 'audio', title: 'Audio', sub: 'Extract wav' },
    { id: 'sanitize', title: 'Sanitize', sub: 'Clean & curate' },
    { id: 'srt', title: 'SRT', sub: 'Transcribe' },
    { id: 'tts', title: 'TTS', sub: 'Synthesize' },
];

const placeholderThumb = 'https://static-cdn.jtvnw.net/ttv-static/404_preview-320x180.png';

type StepId = 'vod' | 'audio' | 'sanitize' | 'srt' | 'tts';
type RunState = 'idle' | 'running' | 'done' | 'error';

type StepDefinition = {
    id: StepId;
    title: string;
    sub: string;
};

type StepState = {
    status: RunState;
    message?: string;
    ready?: boolean;
    exitCode?: number;
};

type Paths = {
    audio?: string;
    clean?: string;
    segments?: string;
    srt?: string;
    srtLines?: number;
    tts?: string;
};

type Flags = {
    force: boolean;
    demucs: boolean;
    skipAac: boolean;
};

const initialFlags: Flags = { force: false, demucs: false, skipAac: false };

type SanitizeSettingsState = {
    silenceThresholdDb: number;
    minSegmentMs: number;
    mergeGapMs: number;
    targetPeakDb: number;
    fadeMs: number;
};

const initialSanitizeSettings: SanitizeSettingsState = {
    silenceThresholdDb: -45,
    minSegmentMs: 800,
    mergeGapMs: 300,
    targetPeakDb: -1,
    fadeMs: 20,
};

type SanitizeRunMeta = SanitizeResult & { appliedSettings: SanitizeSettingsState };

const sanitizeLabelMap: Record<keyof SanitizeSettingsState, string> = {
    silenceThresholdDb: 'Silence threshold (dB)',
    minSegmentMs: 'Min segment (ms)',
    mergeGapMs: 'Merge gap (ms)',
    targetPeakDb: 'Target peak (dB)',
    fadeMs: 'Fade (ms)',
};

type PreviewAudioState = {
    loading: boolean;
    error: string | null;
    objectUrl: string | null;
    sampleRate: number;
    duration: number;
};

const initialPreviewState: PreviewAudioState = { loading: false, error: null, objectUrl: null, sampleRate: 0, duration: 0 };
const initialWaveform: number[] = [];

type ReviewDecision = 'accept' | 'reject';
type ReviewVotes = Record<number, ReviewDecision>;

type ExportedClipsState = {
    dir: string;
    count: number;
    sampleRate: number;
    items: Array<ExportClipItem & { url?: string | null }>;
};

const cardShell = 'rounded-xl border border-slate-800 bg-slate-900/90';
const softCard = 'rounded-lg border border-slate-800 bg-slate-900/80';
const primaryButton = 'px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold text-sm transition hover:translate-y-[-1px] disabled:opacity-60 disabled:cursor-not-allowed';
const ghostButton = 'px-4 py-2 rounded-lg border border-slate-700 text-sm text-slate-100 transition hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed';

export default function App() {
    const apiRef = useRef<WizardApi>(createApi());
    const [step, setStep] = useState<StepId>('vod');
    const [vodUrl, setVodUrl] = useState('');
    const [vodMeta, setVodMeta] = useState<VodMeta | null>(null);
    const [flags, setFlags] = useState<Flags>(initialFlags);
    const [flow, setFlow] = useState<Record<StepId, StepState>>({
        vod: { status: 'idle' },
        audio: { status: 'idle' },
        sanitize: { status: 'idle' },
        srt: { status: 'idle' },
        tts: { status: 'idle' },
    });
    const [paths, setPaths] = useState<Paths>({});
    const [logs, setLogs] = useState<string[]>([]);
    const [showLogs, setShowLogs] = useState(true);
    const [srtExcerpt, setSrtExcerpt] = useState('');
    const [ttsText, setTtsText] = useState('Thanks for hanging out, chat. See you next stream!');
    const [sanitizeSettings, setSanitizeSettings] = useState<SanitizeSettingsState>(initialSanitizeSettings);
    const [sanitizeRun, setSanitizeRun] = useState<SanitizeRunMeta | null>(null);
    const [sanitizeDrawerOpen, setSanitizeDrawerOpen] = useState(false);
    const [previewState, setPreviewState] = useState<PreviewAudioState>(initialPreviewState);
    const previewObjectUrlRef = useRef<string | null>(null);
    const sanitizeBufferRef = useRef<AudioBuffer | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const motionTimerRef = useRef<number | null>(null);
    const reviewSaveTimerRef = useRef<number | null>(null);
    const reviewLoadedRef = useRef(false);
    const reviewSkipNextSaveRef = useRef(false);
    const [previewPlaying, setPreviewPlaying] = useState(false);
    const [previewWaveform, setPreviewWaveform] = useState<number[]>(initialWaveform);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewIndex, setReviewIndex] = useState(0);
    const [reviewVotes, setReviewVotes] = useState<ReviewVotes>({});
    const [reviewMotion, setReviewMotion] = useState<ReviewDecision | null>(null);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewSyncState, setReviewSyncState] = useState<{ saving: boolean; savedAt?: string | null; error?: string | null }>(
        { saving: false, savedAt: undefined, error: null }
    );
    const [exportingClips, setExportingClips] = useState(false);
    const [exportedClips, setExportedClips] = useState<ExportedClipsState | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [exportCopied, setExportCopied] = useState(false);
    const [exportSignature, setExportSignature] = useState<string | null>(null);
    const [consoleFollow, setConsoleFollow] = useState(true);
    const consoleRef = useRef<HTMLPreElement | null>(null);

    useEffect(() => {
        return () => {
            if (previewObjectUrlRef.current) {
                URL.revokeObjectURL(previewObjectUrlRef.current);
                previewObjectUrlRef.current = null;
            }
            audioSourceRef.current?.stop();
            audioSourceRef.current = null;
            audioContextRef.current?.close();
            if (motionTimerRef.current) {
                window.clearTimeout(motionTimerRef.current);
                motionTimerRef.current = null;
            }
            if (reviewSaveTimerRef.current) {
                window.clearTimeout(reviewSaveTimerRef.current);
                reviewSaveTimerRef.current = null;
            }
        };
    }, []);

    const setFlowState = (id: StepId, patch: Partial<StepState>) => {
        setFlow((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const appendLog = (entry: string) => setLogs((prev) => [...prev, entry]);
    const appendLogs = (entries: string[]) => setLogs((prev) => [...prev, ...entries]);

    const updateSanitizeSetting = (key: keyof SanitizeSettingsState, value: number) => {
        setSanitizeSettings((prev) => ({ ...prev, [key]: value }));
    };

    const stopPreview = useCallback(() => {
        if (audioSourceRef.current) {
            try {
                audioSourceRef.current.stop();
            } catch (err) {
                console.warn('Failed to stop preview', err);
            }
            audioSourceRef.current = null;
        }
        setPreviewPlaying(false);
    }, []);

    const resetPreviewState = (override?: Partial<PreviewAudioState>) => {
        stopPreview();
        sanitizeBufferRef.current = null;
        setPreviewState((prev) => {
            if (prev.objectUrl) {
                URL.revokeObjectURL(prev.objectUrl);
                previewObjectUrlRef.current = null;
            }
            return { ...initialPreviewState, ...override };
        });
    };

    const loadPreviewAudio = async (path?: string) => {
        if (!path) {
            resetPreviewState();
            setPreviewWaveform(initialWaveform);
            return;
        }
        resetPreviewState({ loading: true });
        try {
            const artifactUrl = apiRef.current.artifactUrl(path);
            if (!artifactUrl) {
                throw new Error('Artifact endpoint unavailable in mock mode');
            }
            const resp = await fetch(artifactUrl);
            if (!resp.ok) {
                throw new Error(`Failed to fetch preview (${resp.status})`);
            }
            const arrayBuffer = await resp.arrayBuffer();
            const ctx = audioContextRef.current ?? new AudioContext();
            audioContextRef.current = ctx;
            const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
            sanitizeBufferRef.current = decoded;
            setPreviewWaveform(buildWaveform(decoded));
            const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
            const objectUrl = URL.createObjectURL(blob);
            previewObjectUrlRef.current = objectUrl;
            setPreviewState({
                loading: false,
                error: null,
                objectUrl,
                sampleRate: decoded.sampleRate,
                duration: decoded.duration,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Preview load failed';
            resetPreviewState({ error: message });
            setPreviewWaveform(initialWaveform);
        }
    };

    const playPreview = async () => {
        const buffer = sanitizeBufferRef.current;
        if (!buffer) return;
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
        }
        const ctx = audioContextRef.current;
        try {
            await ctx.resume();
        } catch (err) {
            console.warn('Unable to resume AudioContext', err);
        }
        stopPreview();
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        audioSourceRef.current = source;
        setPreviewPlaying(true);
        source.onended = () => {
            audioSourceRef.current = null;
            setPreviewPlaying(false);
        };
        source.start();
    };

    const playSegmentSnippet = useCallback(
        async (segment?: SegmentPreview | null) => {
            if (!segment) return;
            if (!sanitizeBufferRef.current && sanitizeRun?.previewPath) {
                await loadPreviewAudio(sanitizeRun.previewPath);
            }
            const buffer = sanitizeBufferRef.current;
            if (!buffer) return;
            if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext();
            }
            const ctx = audioContextRef.current;
            await ctx.resume().catch((err) => console.warn('Unable to resume AudioContext', err));
            stopPreview();
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            audioSourceRef.current = source;
            setPreviewPlaying(true);
            source.onended = () => {
                if (audioSourceRef.current === source) {
                    audioSourceRef.current = null;
                }
                setPreviewPlaying(false);
            };
            const offset = Math.max(0, segment.start);
            const duration = Math.max(0.15, segment.duration);
            try {
                source.start(0, offset, duration);
            } catch (err) {
                console.warn('Unable to start snippet playback', err);
                setPreviewPlaying(false);
            }
        },
        [loadPreviewAudio, sanitizeRun, stopPreview]
    );

    const vodReady = flow.vod.status === 'done' && !!flow.vod.ready;
    const audioReady = flow.audio.status === 'done' && !!flow.audio.ready;
    const sanitizeReady = flow.sanitize.status === 'done' && !!flow.sanitize.ready;
    const srtReady = flow.srt.status === 'done' && !!flow.srt.ready;
    const sanitizeBusy = flow.sanitize.status === 'running';

    const sanitizeSettingsDirty = useMemo(() => {
        if (!sanitizeRun) return false;
        return (Object.keys(sanitizeSettings) as (keyof SanitizeSettingsState)[]).some(
            (key) => sanitizeSettings[key] !== sanitizeRun.appliedSettings[key]
        );
    }, [sanitizeRun, sanitizeSettings]);

    const sanitizeDiffNotes = useMemo(() => {
        if (!sanitizeRun) return [] as string[];
        const notes: string[] = [];
        (Object.keys(sanitizeSettings) as (keyof SanitizeSettingsState)[]).forEach((key) => {
            if (sanitizeSettings[key] !== sanitizeRun.appliedSettings[key]) {
                notes.push(`${sanitizeLabelMap[key]} → ${sanitizeSettings[key]}`);
            }
        });
        return notes;
    }, [sanitizeRun, sanitizeSettings]);

    const sanitizeTimeline = sanitizeRun?.previewSegments ?? [];
    const sanitizeTimelineTotal = Math.max(1, sanitizeRun?.cleanDuration ?? 1);
    const sanitizeDurationLabel = useMemo(() => formatDuration(sanitizeRun?.cleanDuration ?? 0), [sanitizeRun]);
    const reviewComplete = sanitizeTimeline.length > 0 && reviewIndex >= sanitizeTimeline.length;
    const currentReviewSegment = !reviewComplete ? sanitizeTimeline[reviewIndex] ?? null : null;
    const nextReviewSegment = !reviewComplete ? sanitizeTimeline[reviewIndex + 1] ?? null : null;
    const acceptedCount = useMemo(() => Object.values(reviewVotes).filter((vote) => vote === 'accept').length, [reviewVotes]);
    const rejectedCount = useMemo(() => Object.values(reviewVotes).filter((vote) => vote === 'reject').length, [reviewVotes]);
    const pendingCount = Math.max(0, sanitizeTimeline.length - acceptedCount - rejectedCount);
    const reviewProgress = sanitizeTimeline.length ? Math.min(reviewIndex / sanitizeTimeline.length, 1) : 0;

    const sanitizeInstructionPlan = useMemo(
        () => [
            `Trim silence below ${sanitizeSettings.silenceThresholdDb} dB`,
            `Keep regions ≥ ${sanitizeSettings.minSegmentMs} ms`,
            `Merge gaps < ${sanitizeSettings.mergeGapMs} ms`,
            `Normalize to ${sanitizeSettings.targetPeakDb} dB`,
            `Crossfade ${sanitizeSettings.fadeMs} ms edges`,
        ],
        [sanitizeSettings]
    );

    useEffect(() => {
        if (!sanitizeRun || !vodUrl) {
            setReviewVotes({});
            setReviewIndex(0);
            setReviewMotion(null);
            setReviewLoading(false);
            setReviewSyncState({ saving: false, savedAt: undefined, error: null });
            reviewLoadedRef.current = false;
            reviewSkipNextSaveRef.current = true;
            setExportedClips(null);
            setExportError(null);
            return;
        }
        const timelineLength = sanitizeTimeline.length;
        if (!timelineLength) {
            setReviewVotes({});
            setReviewIndex(0);
            setReviewMotion(null);
            setReviewLoading(false);
            reviewLoadedRef.current = true;
            reviewSkipNextSaveRef.current = true;
            setExportedClips(null);
            setExportError(null);
            return;
        }
        let cancelled = false;
        setReviewLoading(true);
        reviewLoadedRef.current = false;
        apiRef.current
            .getSegmentReview({ vodUrl })
            .then((data) => {
                if (cancelled) return;
                const nextVotes: ReviewVotes = {};
                data.votes.forEach((vote) => {
                    if (vote.index < timelineLength) {
                        nextVotes[vote.index] = vote.decision;
                    }
                });
                setReviewVotes(nextVotes);
                setReviewIndex(Math.min(data.reviewIndex, timelineLength));
                setReviewMotion(null);
                setReviewLoading(false);
                setReviewSyncState((prev) => ({ ...prev, savedAt: data.updatedAt ?? prev.savedAt ?? null, error: null, saving: false }));
                reviewLoadedRef.current = true;
                reviewSkipNextSaveRef.current = true;
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to load segment review', err);
                setReviewVotes({});
                setReviewIndex(0);
                setReviewMotion(null);
                setReviewLoading(false);
                setReviewSyncState((prev) => ({ ...prev, error: err instanceof Error ? err.message : 'Failed to load review', saving: false }));
                reviewLoadedRef.current = true;
                reviewSkipNextSaveRef.current = true;
            });
        return () => {
            cancelled = true;
        };
    }, [sanitizeRun, sanitizeTimeline.length, vodUrl]);

    useEffect(() => {
        if (!sanitizeRun || !vodUrl) return;
        if (!sanitizeTimeline.length) return;
        if (!reviewLoadedRef.current) return;
        if (reviewSkipNextSaveRef.current) {
            reviewSkipNextSaveRef.current = false;
            return;
        }

        if (reviewSaveTimerRef.current) {
            window.clearTimeout(reviewSaveTimerRef.current);
            reviewSaveTimerRef.current = null;
        }

        reviewSaveTimerRef.current = window.setTimeout(() => {
            const votesPayload: SegmentReviewVote[] = Object.entries(reviewVotes)
                .map(([index, decision]) => {
                    const idx = Number(index);
                    const seg = sanitizeTimeline[idx];
                    if (!seg) return null;
                    return { index: idx, decision, segment: seg } as SegmentReviewVote;
                })
                .filter((entry): entry is SegmentReviewVote => Boolean(entry))
                .sort((a, b) => a.index - b.index);

            setReviewSyncState((prev) => ({ ...prev, saving: true, error: null }));

            apiRef.current
                .saveSegmentReview({
                    vodUrl,
                    totalSegments: sanitizeTimeline.length,
                    reviewIndex,
                    votes: votesPayload,
                })
                .then((res) => {
                    setReviewSyncState({ saving: false, savedAt: res.updatedAt ?? new Date().toISOString(), error: null });
                })
                .catch((err) => {
                    setReviewSyncState((prev) => ({ ...prev, saving: false, error: err instanceof Error ? err.message : 'Failed to save review' }));
                })
                .finally(() => {
                    if (reviewSaveTimerRef.current) {
                        window.clearTimeout(reviewSaveTimerRef.current);
                        reviewSaveTimerRef.current = null;
                    }
                });
        }, 600);

        return () => {
            if (reviewSaveTimerRef.current) {
                window.clearTimeout(reviewSaveTimerRef.current);
                reviewSaveTimerRef.current = null;
            }
        };
    }, [reviewVotes, reviewIndex, sanitizeRun, sanitizeTimeline, vodUrl]);

    const ensurePreviewReady = useCallback(() => {
        if (!sanitizeRun?.previewPath) return;
        if (sanitizeBufferRef.current) return;
        if (previewState.loading) return;
        void loadPreviewAudio(sanitizeRun.previewPath);
    }, [previewState.loading, sanitizeRun]);

    useEffect(() => {
        if (!reviewOpen) return;
        ensurePreviewReady();
    }, [ensurePreviewReady, reviewOpen]);

    const launchSegmentReview = useCallback(() => {
        if (!sanitizeTimeline.length) return;
        ensurePreviewReady();
        setReviewOpen(true);
        setReviewMotion(null);
    }, [ensurePreviewReady, sanitizeTimeline.length]);

    const closeSegmentReview = useCallback(() => {
        setReviewOpen(false);
        setReviewMotion(null);
    }, []);

    const handleReviewVote = useCallback(
        (decision: ReviewDecision) => {
            if (!sanitizeTimeline.length) return;
            if (reviewMotion) return;
            if (reviewComplete) return;
            const idx = Math.min(reviewIndex, sanitizeTimeline.length - 1);
            setReviewVotes((prev) => ({ ...prev, [idx]: decision }));
            setReviewMotion(decision);
            stopPreview();
            if (motionTimerRef.current) {
                window.clearTimeout(motionTimerRef.current);
            }
            motionTimerRef.current = window.setTimeout(() => {
                setReviewMotion(null);
                setReviewIndex((prev) => Math.min(prev + 1, sanitizeTimeline.length));
                motionTimerRef.current = null;
            }, 360);
        },
        [reviewComplete, reviewIndex, reviewMotion, sanitizeTimeline.length, stopPreview]
    );

    const handleReviewBack = useCallback(() => {
        if (reviewIndex === 0) return;
        if (motionTimerRef.current) {
            window.clearTimeout(motionTimerRef.current);
            motionTimerRef.current = null;
        }
        setReviewMotion(null);
        stopPreview();
        setReviewIndex((prev) => Math.max(prev - 1, 0));
    }, [reviewIndex, stopPreview]);

    const handleReviewRestart = () => {
        if (!sanitizeTimeline.length) return;
        if (motionTimerRef.current) {
            window.clearTimeout(motionTimerRef.current);
            motionTimerRef.current = null;
        }
        setReviewIndex(0);
        setReviewMotion(null);
        setReviewVotes({});
    };

    const jumpToSegment = useCallback(
        async (idx: number) => {
            if (!sanitizeTimeline.length) return;
            const clamped = Math.max(0, Math.min(idx, sanitizeTimeline.length - 1));
            setReviewMotion(null);
            setReviewIndex(clamped);
            stopPreview();
            const seg = sanitizeTimeline[clamped];
            if (seg) {
                await playSegmentSnippet(seg);
            }
        },
        [playSegmentSnippet, sanitizeTimeline, stopPreview]
    );

    const reviewSignature = useMemo(() => reviewSignatureKey(reviewVotes, sanitizeTimeline.length), [reviewVotes, sanitizeTimeline.length]);

    const exportAcceptedClips = async () => {
        if (!sanitizeRun || !sanitizeTimeline.length || !vodUrl) return;
        setExportingClips(true);
        setExportError(null);
        setExportedClips(null);
        setExportCopied(false);
        try {
            const votesPayload: SegmentReviewVote[] = Object.entries(reviewVotes)
                .map(([index, decision]) => {
                    const idx = Number(index);
                    const seg = sanitizeTimeline[idx];
                    if (!seg) return null;
                    return { index: idx, decision, segment: seg } as SegmentReviewVote;
                })
                .filter((entry): entry is SegmentReviewVote => Boolean(entry))
                .sort((a, b) => a.index - b.index);

            // ensure latest votes are persisted before export
            await apiRef.current.saveSegmentReview({
                vodUrl,
                totalSegments: sanitizeTimeline.length,
                reviewIndex,
                votes: votesPayload,
            });

            const res = await apiRef.current.exportClips({ vodUrl });
            const itemsWithUrl = res.items.map((item) => ({
                ...item,
                url: apiRef.current.artifactUrl(item.path) || null,
            }));
            setExportedClips({ dir: res.clipsDir, count: res.count, sampleRate: res.sampleRate, items: itemsWithUrl });
            setExportSignature(reviewSignature);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Export failed';
            setExportError(message);
        } finally {
            setExportingClips(false);
        }
    };

    const copyExportDir = useCallback(async () => {
        if (!exportedClips?.dir) return;
        if (!navigator.clipboard) return;
        try {
            await navigator.clipboard.writeText(exportedClips.dir);
            setExportCopied(true);
            window.setTimeout(() => setExportCopied(false), 1200);
        } catch (err) {
            console.warn('Failed to copy export dir', err);
        }
    }, [exportedClips]);

    const openFirstClip = useCallback(() => {
        if (!exportedClips?.items?.length) return;
        const target = exportedClips.items.find((item) => item.url)?.url;
        if (target) {
            window.open(target, '_blank');
        }
    }, [exportedClips]);

    const exportNeedsRefresh = useMemo(() => {
        if (!exportedClips) return false;
        if (!exportSignature) return false;
        return reviewSignature !== exportSignature;
    }, [exportedClips, exportSignature, reviewSignature]);

    useEffect(() => {
        if (!reviewOpen) return;
        if (reviewComplete) return;
        if (!currentReviewSegment) return;
        void playSegmentSnippet(currentReviewSegment);
    }, [reviewOpen, reviewComplete, currentReviewSegment, playSegmentSnippet]);

    useEffect(() => {
        if (!reviewOpen) {
            stopPreview();
            return;
        }
        const handler = (event: KeyboardEvent) => {
            if (!reviewOpen) return;
            if (event.ctrlKey || event.altKey || event.metaKey) return;
            if (event.code === 'Enter' || event.key === 'Enter') {
                event.preventDefault();
                handleReviewVote('accept');
            } else if (event.code === 'Space' || event.key === ' ') {
                event.preventDefault();
                handleReviewVote('reject');
            } else if (event.code === 'ArrowLeft') {
                event.preventDefault();
                handleReviewBack();
            } else if (event.code === 'Escape') {
                event.preventDefault();
                closeSegmentReview();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [closeSegmentReview, handleReviewBack, handleReviewVote, reviewOpen, stopPreview]);

    const isStepUnlocked = (id: StepId) => {
        if (id === 'vod') return true;
        if (id === 'audio') return vodReady;
        if (id === 'sanitize') return audioReady;
        if (id === 'srt') return sanitizeReady;
        if (id === 'tts') return srtReady;
        return false;
    };

    const stepIndex = steps.findIndex((s) => s.id === step);
    const nextId: StepId | undefined = stepIndex >= 0 && stepIndex < steps.length - 1 ? steps[stepIndex + 1].id : undefined;
    const nextUnlocked = nextId ? isStepUnlocked(nextId) : false;

    const goNext = () => {
        if (stepIndex >= 0 && stepIndex < steps.length - 1) {
            const next = steps[stepIndex + 1].id;
            if (isStepUnlocked(next)) {
                setStep(next);
            }
        }
    };

    const goPrev = () => {
        if (stepIndex > 0) {
            setStep(steps[stepIndex - 1].id);
        }
    };

    const statusTag = (state?: StepState) => {
        if (!state || state.status === 'idle') return undefined;
        return state.status;
    };

    const progressWidth = (state?: StepState) => {
        if (!state) return '0%';
        if (state.status === 'running') return '60%';
        if (state.status === 'done') return '100%';
        if (state.status === 'error') return '100%';
        return '0%';
    };

    const renderStepStatus = (state?: StepState) => {
        if (!state || state.status === 'idle') return null;
        if (state.status === 'running') {
            return (
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-accent">
                    <span className="w-2 h-2 rounded-full bg-accent animate-ping" aria-hidden />
                    Working...
                </span>
            );
        }
        if (state.status === 'error') {
            return <span className="text-xs font-semibold text-rose-300">Errored</span>;
        }
        if (state.status === 'done') {
            return <span className="text-xs font-semibold text-green-300">Complete</span>;
        }
        return null;
    };

    const datasetPath = vodMeta ? `dataset/${vodMeta.streamer}` : 'dataset/<streamer>';

    const runVodCheck = async () => {
        if (!vodUrl) return;
        setFlowState('vod', { status: 'running', ready: false, message: 'Fetching metadata...' });
        appendLog(`[vod] check ${vodUrl}`);
        try {
            const meta = await apiRef.current.checkVod(vodUrl);
            setVodMeta(meta);
            setFlowState('vod', { status: 'done', ready: true, message: 'Metadata loaded' });
            appendLog('[vod] ok');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Metadata lookup failed';
            setFlowState('vod', { status: 'error', ready: false, message });
            appendLog(`[vod] error: ${message}`);
        }
    };

    const runAudio = async () => {
        if (!vodReady) return;
        setFlowState('audio', { status: 'running', ready: false, message: 'Extracting audio...' });
        appendLog('[audio] extracting');
        try {
            const res = await apiRef.current.runAudio({
                vodUrl,
                force: flags.force,
                useDemucs: flags.demucs,
                skipAac: flags.skipAac,
            });
            setPaths((prev) => ({ ...prev, audio: res.path }));
            setFlowState('audio', {
                status: res.exitCode === 0 ? 'done' : 'error',
                ready: res.exitCode === 0,
                exitCode: res.exitCode,
                message: `exit ${res.exitCode}`,
            });
            appendLogs(res.log ?? []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Audio extraction failed';
            setFlowState('audio', { status: 'error', ready: false, message });
            appendLog(`[audio] error: ${message}`);
        }
    };

    const runSanitize = async () => {
        if (!audioReady) return;
        setFlowState('sanitize', { status: 'running', ready: false, message: 'Sanitizing audio...' });
        appendLog('[sanitize] start');
        try {
            const payload = {
                vodUrl,
                silenceThresholdDb: sanitizeSettings.silenceThresholdDb,
                minSegmentMs: sanitizeSettings.minSegmentMs,
                mergeGapMs: sanitizeSettings.mergeGapMs,
                targetPeakDb: sanitizeSettings.targetPeakDb,
                fadeMs: sanitizeSettings.fadeMs,
            };
            const res = await apiRef.current.runSanitize(payload);
            setPaths((prev) => ({ ...prev, clean: res.cleanPath, segments: res.segmentsPath }));
            setSanitizeRun({ ...res, appliedSettings: { ...sanitizeSettings } });
            void loadPreviewAudio(res.previewPath);
            setFlowState('sanitize', {
                status: res.exitCode === 0 ? 'done' : 'error',
                ready: res.exitCode === 0,
                exitCode: res.exitCode,
                message: `exit ${res.exitCode}`,
            });
            appendLogs(res.log ?? []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Sanitization failed';
            setFlowState('sanitize', { status: 'error', ready: false, message });
            appendLog(`[sanitize] error: ${message}`);
            resetPreviewState();
        }
    };

    const runSrt = async () => {
        if (!sanitizeReady) return;
        setFlowState('srt', { status: 'running', ready: false, message: 'Transcribing...' });
        appendLog('[srt] start');
        try {
            const res = await apiRef.current.runSrt({ vodUrl });
            setPaths((prev) => ({ ...prev, srt: res.path, srtLines: res.lines }));
            setSrtExcerpt(res.excerpt.replace(/\\n/g, '\n'));
            setFlowState('srt', {
                status: res.exitCode === 0 ? 'done' : 'error',
                ready: res.exitCode === 0 && res.lines > 0,
                exitCode: res.exitCode,
                message: `lines ${res.lines}`,
            });
            appendLogs(res.log ?? []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Transcription failed';
            setFlowState('srt', { status: 'error', ready: false, message });
            appendLog(`[srt] error: ${message}`);
        }
    };

    const runTts = async () => {
        if (!srtReady || !vodMeta) return;
        setFlowState('tts', { status: 'running', ready: false, message: 'Synthesizing...' });
        appendLog('[tts] start');
        try {
            const res = await apiRef.current.runTts({ vodUrl, text: ttsText, streamer: vodMeta.streamer });
            setPaths((prev) => ({ ...prev, tts: res.outputPath }));
            setFlowState('tts', {
                status: res.exitCode === 0 ? 'done' : 'error',
                ready: res.exitCode === 0,
                exitCode: res.exitCode,
                message: `exit ${res.exitCode}`,
            });
            appendLogs(res.log ?? []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'TTS failed';
            setFlowState('tts', { status: 'error', ready: false, message });
            appendLog(`[tts] error: ${message}`);
        }
    };

    const activeThumb = vodMeta?.previewUrl || placeholderThumb;
    const streamerSlug = vodMeta?.streamer ?? '<streamer>';
    const vodId = vodMeta?.vodId ?? '<vodId>';

    useEffect(() => {
        if (!showLogs || !consoleFollow) return;
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [logs, showLogs, consoleFollow]);

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto w-full max-w-[1200px] px-4 py-6 lg:px-6">
                <div className="grid gap-4 lg:grid-cols-[280px,1fr,320px] lg:items-start">
                    {/* Left Sidebar */}
                    <aside className="relative w-full flex-shrink-0 p-5 flex flex-col gap-5 rounded-xl border border-white/5 bg-panel/80">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.16em] text-accent">
                                Tailwind flow
                            </div>
                            <h1 className="text-2xl font-semibold leading-tight">Streamcraft</h1>
                            <p className="text-xs text-slate-400">VOD → TTS Pipeline</p>
                        </div>

                        <div className={`${cardShell} p-4 flex-1`}>
                            <div className="flex flex-col gap-1 mb-4">
                                <span className="inline-flex items-center gap-2 text-xs font-semibold text-accent">Live steps</span>
                                <span className="text-xs text-slate-400">All steps run locally.</span>
                            </div>
                            <div className="flex flex-col gap-2">
                                {steps.map((s, index) => {
                                    const state = flow[s.id];
                                    const isActive = step === s.id;
                                    const unlocked = isStepUnlocked(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            className={`w-full text-left border rounded-xl px-3 py-2.5 flex items-center gap-3 transition ${isActive
                                                ? 'border-accent/80 bg-white/5 shadow-md shadow-accent/25'
                                                : unlocked
                                                    ? 'border-white/5 bg-panel/70 hover:border-accent/40'
                                                    : 'border-white/5 bg-panel/70 opacity-50 cursor-not-allowed'
                                                }`}
                                            onClick={() => unlocked && setStep(s.id)}
                                            disabled={!unlocked}
                                        >
                                            <div className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 grid place-items-center text-sm font-semibold text-accent">{index + 1}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold truncate">{s.title}</div>
                                                <div className="text-xs text-slate-400 truncate">{unlocked ? s.sub : 'Locked'}</div>
                                            </div>
                                            {statusTag(state) && (
                                                <span
                                                    className={`text-[11px] px-2 py-1 rounded-full border flex-shrink-0 ${state.status === 'running'
                                                        ? 'border-accent text-accent'
                                                        : state.status === 'error'
                                                            ? 'border-rose-400 text-rose-200'
                                                            : 'border-green-400 text-green-200'
                                                        }`}
                                                >
                                                    {statusTag(state)}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>

                    {/* Main Content */}
                    <main className="relative flex min-h-[calc(100vh-120px)] flex-col overflow-hidden rounded-xl border border-white/5 bg-surface/80">
                        <header className="flex flex-col gap-3 p-5 pb-2">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Step {stepIndex + 1} of {steps.length}</div>
                                    <h2 className="text-2xl font-semibold">{steps[stepIndex]?.title}</h2>
                                    <p className="text-sm text-slate-400">{steps[stepIndex]?.sub}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <StatusPill state={flow[step]} />
                                    <button className={ghostButton} onClick={() => setShowLogs((prev) => !prev)}>
                                        {showLogs ? 'Hide console' : 'Show console'}
                                    </button>
                                    <button className={ghostButton} onClick={() => setConsoleFollow((prev) => !prev)}>
                                        {consoleFollow ? 'Follow on' : 'Follow off'}
                                    </button>
                                </div>
                            </div>
                            <MiniStepper
                                steps={steps}
                                flow={flow}
                                current={step}
                                isUnlocked={isStepUnlocked}
                                onSelect={(id) => isStepUnlocked(id) && setStep(id)}
                            />
                        </header>

                        <div className="flex-1 overflow-y-auto px-5 pb-24 flex flex-col gap-5">
                            {/* Progress bar */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 relative h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="absolute inset-0 bg-accent transition-all duration-300" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
                                </div>
                                <span className="text-xs text-slate-400 whitespace-nowrap">{stepIndex + 1} / {steps.length}</span>
                            </div>

                            {step === 'vod' && (
                                <section className={`${cardShell} p-5`}>
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <div>
                                            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Step 1</div>
                                            <h2 className="text-xl font-semibold">VOD check</h2>
                                        </div>
                                        <span className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-200">metadata</span>
                                    </div>
                                    <div className="grid lg:grid-cols-[2fr,1fr] gap-5">
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-sm font-semibold">VOD URL</label>
                                                <input
                                                    className="mt-1 w-full rounded-xl border border-white/10 bg-surface/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/60 placeholder:text-slate-500"
                                                    value={vodUrl}
                                                    onChange={(e) => setVodUrl(e.target.value)}
                                                    placeholder="https://www.twitch.tv/videos/123456"
                                                />
                                                <p className="text-xs text-slate-400 mt-1">Paste a Twitch VOD link. Next unlocks after metadata loads.</p>
                                            </div>
                                            <div className="flex flex-wrap gap-3 text-sm">
                                                <label className="inline-flex items-center gap-2">
                                                    <input type="checkbox" checked={flags.force} onChange={(e) => setFlags({ ...flags, force: e.target.checked })} />
                                                    Force re-run
                                                </label>
                                                <label className="inline-flex items-center gap-2">
                                                    <input type="checkbox" checked={flags.demucs} onChange={(e) => setFlags({ ...flags, demucs: e.target.checked })} />
                                            </div>

                                            {/* Sticky navigation */}
                                            <div className="sticky bottom-0 z-10 border-t border-white/10 bg-surface/90 backdrop-blur px-5 py-4 flex items-center justify-between gap-4">
                                                <button className={ghostButton} onClick={goPrev} disabled={stepIndex === 0}>
                                                    ← Previous
                                                </button>
                                                <span className="text-sm text-slate-400">Complete each step to unlock the next</span>
                                                <button
                                                    className={primaryButton}
                                                    onClick={goNext}
                                                    disabled={stepIndex === steps.length - 1 || !nextUnlocked}
                                                >
                                                    Next →
                                                </button>
                                            </div>
                                        </main>

                                        {/* Console column (stacks under main on small, sticky on desktop) */}
                                        <div className="lg:sticky lg:top-6">
                                            <ConsolePanel
                                                className="h-full"
                                                logs={logs}
                                                show={showLogs}
                                                follow={consoleFollow}
                                                onToggle={() => setShowLogs((prev) => !prev)}
                                                onToggleFollow={() => setConsoleFollow((prev) => !prev)}
                                                onClear={() => setLogs([])}
                                                panelRef={consoleRef}
                                            />
                                        </div>
                                    </div>
                                </div>
                                        </div>
                </div>
            </div>
        </section>
    )
}

{
    step === 'audio' && (
        <section className={`${cardShell} p-5`}>
            <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                    <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Step 2</div>
                    <h2 className="text-xl font-semibold">Audio extraction</h2>
                    <p className="text-xs text-slate-400 mt-1">{flow.audio.message ?? 'Ready to extract audio'}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-200">wav</span>
                    {renderStepStatus(flow.audio)}
                </div>
            </div>
            <div className="grid lg:grid-cols-[2fr,1fr] gap-4">
                <div className="space-y-3">
                    <div className={`${softCard} p-3`}>
                        <div className="font-semibold text-sm">Status: {flow.audio.message ?? 'Waiting'}</div>
                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                            <div className="absolute inset-0 bg-accent" style={{ width: progressWidth(flow.audio) }} />
                        </div>
                        <div className="text-xs text-slate-400">Acceptance: exit 0 + file exists</div>
                        {paths.audio && <div className="text-sm mt-1">Output: {paths.audio}</div>}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5">Exit: {flow.audio.exitCode ?? '—'}</span>
                        {audioReady && <span className="px-2 py-1 rounded-full border border-green-500 text-green-200">ready</span>}
                    </div>
                    <div className="flex gap-2">
                        <button className={primaryButton} onClick={runAudio} disabled={!vodReady}>
                            Extract audio
                        </button>
                        <button className={ghostButton} onClick={goNext} disabled={!audioReady}>
                            Next
                        </button>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="text-xs text-slate-400">Pinned preview</div>
                    <div className={`${softCard} p-2 text-center`}>
                        <img src={activeThumb} alt="VOD preview" className="w-full rounded-md border border-white/5" />
                        <div className="text-xs text-slate-400 mt-2">{vodReady ? `${streamerSlug} / ${vodId}` : 'Waiting for metadata'}</div>
                    </div>
                </div>
            </div>
        </section>
    )
}

{
    step === 'sanitize' && (
        <section className={`${cardShell} p-5`}>
            <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                    <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Step 3</div>
                    <h2 className="text-xl font-semibold">Audio sanitization</h2>
                    <p className="text-xs text-slate-400 mt-1">{flow.sanitize.message ?? 'Queue audio sanitization job'}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-200">clean wav + manifest</span>
                    {renderStepStatus(flow.sanitize)}
                </div>
            </div>
            <div className="grid lg:grid-cols-[2fr,1fr] gap-5">
                <div className="space-y-4">
                    <div className={`${softCard} p-3 space-y-2`}>
                        <div className="font-semibold text-sm">Status: {flow.sanitize.message ?? 'Waiting'}</div>
                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div className="absolute inset-0 bg-accent" style={{ width: progressWidth(flow.sanitize) }} />
                        </div>
                        <div className="text-xs text-slate-400 flex flex-wrap gap-3">
                            <span>Tasks: trim silence • normalize • voice focus</span>
                            {sanitizeRun && (
                                <span>
                                    Segments {sanitizeRun.segments} • {sanitizeDurationLabel}
                                </span>
                            )}
                        </div>
                        {paths.clean && <div className="text-sm mt-1">Clean: {paths.clean}</div>}
                        {paths.segments && <div className="text-sm">Segments: {paths.segments}</div>}
                    </div>

                    <div className={`${softCard} p-3 space-y-3`}>
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.08em] text-slate-400">
                            <span>Processing stack</span>
                            {sanitizeSettingsDirty && <span className="text-amber-300 font-semibold">pending change</span>}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3 text-sm">
                            <SettingControl
                                label="Silence"
                                hint="Threshold (dB)"
                                value={sanitizeSettings.silenceThresholdDb}
                                min={-70}
                                max={-10}
                                step={1}
                                onChange={(val) => updateSanitizeSetting('silenceThresholdDb', val)}
                            />
                            <SettingControl
                                label="Min segment"
                                hint="ms"
                                value={sanitizeSettings.minSegmentMs}
                                min={200}
                                max={3000}
                                step={50}
                                onChange={(val) => updateSanitizeSetting('minSegmentMs', val)}
                            />
                            <SettingControl
                                label="Merge gap"
                                hint="ms"
                                value={sanitizeSettings.mergeGapMs}
                                min={100}
                                max={1000}
                                step={50}
                                onChange={(val) => updateSanitizeSetting('mergeGapMs', val)}
                            />
                            <SettingControl
                                label="Target peak"
                                hint="dB"
                                value={sanitizeSettings.targetPeakDb}
                                min={-18}
                                max={-1}
                                step={0.5}
                                onChange={(val) => updateSanitizeSetting('targetPeakDb', val)}
                            />
                            <SettingControl
                                label="Fade"
                                hint="ms"
                                value={sanitizeSettings.fadeMs}
                                min={5}
                                max={120}
                                step={5}
                                onChange={(val) => updateSanitizeSetting('fadeMs', val)}
                            />
                        </div>
                        <p className="text-xs text-slate-500">Adjust settings before re-running to refine segments. Changes apply on the next sanitize run.</p>
                    </div>

                    {sanitizeDiffNotes.length > 0 && (
                        <div className={`${softCard} p-3`}>
                            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Pending instructions</div>
                            <ul className="mt-2 text-sm space-y-1 text-amber-200/90 list-disc list-inside">
                                {sanitizeDiffNotes.map((note) => (
                                    <li key={note}>{note}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5">Exit: {flow.sanitize.exitCode ?? '—'}</span>
                        {sanitizeReady && <span className="px-2 py-1 rounded-full border border-green-500 text-green-200">ready</span>}
                        <button className={ghostButton} onClick={() => setSanitizeDrawerOpen(true)} disabled={!sanitizeRun}>
                            Open editor
                        </button>
                        <button className={ghostButton} onClick={launchSegmentReview} disabled={!sanitizeTimeline.length || reviewLoading}>
                            {reviewLoading ? 'Loading votes…' : 'Segment review'}
                        </button>
                    </div>
                    {sanitizeTimeline.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                            <span className="px-2 py-0.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-200">
                                Keep {acceptedCount}
                            </span>
                            <span className="px-2 py-0.5 rounded-full border border-rose-400/40 bg-rose-400/10 text-rose-200">
                                Drop {rejectedCount}
                            </span>
                            <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5">
                                Pending {pendingCount}
                            </span>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <button className={primaryButton} onClick={runSanitize} disabled={!audioReady || sanitizeBusy}>
                            {sanitizeBusy ? 'Running…' : 'Run sanitization'}
                        </button>
                        <button className={ghostButton} onClick={goNext} disabled={!sanitizeReady}>
                            Next
                        </button>
                        <button
                            className={ghostButton}
                            onClick={exportAcceptedClips}
                            disabled={!acceptedCount || exportingClips}
                        >
                            {exportingClips ? 'Exporting…' : 'Export accepted clips'}
                        </button>
                    </div>
                    {(exportedClips || exportError) && (
                        <div className={`${softCard} p-3 space-y-2`}>
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="uppercase tracking-[0.08em] text-slate-400">Export</span>
                                    {exportedClips && exportedClips.count > 0 && (
                                        <span className="px-2 py-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-200">
                                            Saved {exportedClips.count} clips @ {exportedClips.sampleRate} Hz
                                        </span>
                                    )}
                                    {exportNeedsRefresh && (
                                        <span className="px-2 py-1 rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-200">
                                            Votes changed — re-export
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {exportedClips && (
                                        <>
                                            <button className={ghostButton} onClick={copyExportDir}>
                                                {exportCopied ? 'Copied path' : 'Copy path'}
                                            </button>
                                            {exportedClips.items.some((item) => item.url) && (
                                                <button className={ghostButton} onClick={openFirstClip}>
                                                    Open first clip
                                                </button>
                                            )}
                                            {exportNeedsRefresh && (
                                                <button
                                                    className={primaryButton}
                                                    onClick={exportAcceptedClips}
                                                    disabled={exportingClips}
                                                >
                                                    {exportingClips ? 'Re-exporting…' : 'Re-export'}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                            {exportedClips && (
                                <div className="text-xs text-slate-300 break-all">Dir: {exportedClips.dir}</div>
                            )}
                            {exportError && <div className="text-rose-300 text-xs">{exportError}</div>}
                            {exportedClips?.items?.length ? (
                                <div className="max-h-60 overflow-auto space-y-2">
                                    {exportedClips.items.map((item) => {
                                        const itemUrl = item.url ?? apiRef.current.artifactUrl(item.path) ?? '';
                                        return (
                                            <div
                                                key={`${item.index}-${item.start}`}
                                                className="space-y-1 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-xs"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="min-w-[180px]">
                                                        <div className="text-slate-100 font-semibold">
                                                            #{item.index} • {item.duration.toFixed(2)}s
                                                        </div>
                                                        <div className="text-slate-400">
                                                            t={formatSeconds(item.start)} → t={formatSeconds(item.end)}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-slate-500 truncate max-w-[220px]">{item.path}</span>
                                                        {item.url && (
                                                            <a
                                                                className="text-accent font-semibold"
                                                                href={item.url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                            >
                                                                Open
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                                {itemUrl && (
                                                    <audio className="w-full" controls preload="metadata" src={itemUrl} />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>
                <div className="space-y-2">
                    <div className="text-xs text-slate-400">Track view</div>
                    <div className="relative h-56 rounded-2xl border border-white/10 bg-slate-900/70 overflow-hidden">
                        <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_80px)]" />
                        {sanitizeTimeline.length > 0 ? (
                            sanitizeTimeline.map((seg, idx) => {
                                const left = (seg.start / sanitizeTimelineTotal) * 100;
                                const width = Math.max((seg.duration / sanitizeTimelineTotal) * 100, 0.2);
                                const intensity = Math.min(1, Math.max(0.2, 1 - Math.abs(seg.rmsDb) / 60));
                                const vote = reviewVotes[idx];
                                const colorClass =
                                    vote === 'accept'
                                        ? 'bg-emerald-400 shadow-lg shadow-emerald-500/30 border border-emerald-300/60'
                                        : vote === 'reject'
                                            ? 'bg-rose-400/80 shadow-lg shadow-rose-500/25 border border-rose-300/60'
                                            : 'bg-accent border border-transparent';
                                return (
                                    <div
                                        key={`${seg.start}-${idx}`}
                                        className={`absolute top-10 bottom-10 rounded-sm ${colorClass}`}
                                        style={{
                                            left: `${left}%`,
                                            width: `${width}%`,
                                            opacity: intensity,
                                        }}
                                    />
                                );
                            })
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                                Run sanitization to visualize segments.
                            </div>
                        )}
                        <div className="absolute bottom-3 left-4 text-xs text-slate-300">
                            {sanitizeRun ? `${sanitizeRun.segments} segments` : '—'}
                        </div>
                        <div className="absolute bottom-3 right-4 text-xs text-slate-300">{sanitizeDurationLabel}</div>
                    </div>
                    {sanitizeTimeline.length > 0 && (
                        <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-slate-500 px-1">
                            <span className="inline-flex items-center gap-1">
                                <span className="w-3 h-2 rounded-sm bg-emerald-400 inline-block" /> Keep
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <span className="w-3 h-2 rounded-sm bg-rose-400/80 inline-block" /> Drop
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <span className="w-3 h-2 rounded-sm bg-accent inline-block" /> Pending
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}

{
    step === 'srt' && (
        <section className={`${cardShell} p-5`}>
            <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                    <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Step 4</div>
                    <h2 className="text-xl font-semibold">SRT / text extraction</h2>
                    <p className="text-xs text-slate-400 mt-1">{flow.srt.message ?? 'Run transcription after sanitization'}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-200">srt</span>
                    {renderStepStatus(flow.srt)}
                </div>
            </div>
            <div className="grid lg:grid-cols-[2fr,1fr] gap-4">
                <div className="space-y-3">
                    <div className={`${softCard} p-3`}>
                        <div className="font-semibold text-sm">Status: {flow.srt.message ?? 'Waiting'}</div>
                        <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                            <div className="absolute inset-0 bg-accent" style={{ width: progressWidth(flow.srt) }} />
                        </div>
                        <div className="text-xs text-slate-400">Acceptance: srt exists, lines &gt; 0, exit 0</div>
                        {paths.srt && <div className="text-sm mt-1">Output: {paths.srt}</div>}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5">Lines: {paths.srtLines ?? '—'}</span>
                        {srtReady && <span className="px-2 py-1 rounded-full border border-green-500 text-green-200">ready</span>}
                    </div>
                    <div className="flex gap-2">
                        <button className={primaryButton} onClick={runSrt} disabled={!sanitizeReady}>
                            Run transcription
                        </button>
                        <button className={ghostButton} onClick={goNext} disabled={!srtReady}>
                            Next
                        </button>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="text-xs text-slate-400">Excerpt</div>
                    <div className={`${softCard} p-3 min-h-[140px] max-h-[220px] overflow-auto text-sm`}>
                        <pre className="whitespace-pre-wrap m-0">{srtExcerpt || 'Transcript preview will appear here.'}</pre>
                    </div>
                </div>
            </div>
        </section>
    )
}

{
    step === 'tts' && (
        <section className={`${cardShell} p-5`}>
            <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                    <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Step 5</div>
                    <h2 className="text-xl font-semibold">TTS</h2>
                    <p className="text-xs text-slate-400 mt-1">{flow.tts.message ?? 'Synthesize voice from dataset clips'}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-200">xtts_v2</span>
                    {renderStepStatus(flow.tts)}
                </div>
            </div>
            <div className="space-y-3">
                <div className="text-sm text-slate-300">Dataset: {datasetPath} (auto)</div>
                <div>
                    <label className="text-sm font-semibold">Text</label>
                    <textarea
                        className="mt-1 w-full rounded-xl border border-white/10 bg-surface/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/60"
                        value={ttsText}
                        onChange={(e) => setTtsText(e.target.value)}
                        rows={5}
                    />
                </div>
                <div className="flex gap-2">
                    <button className={primaryButton} onClick={runTts} disabled={!srtReady || !vodMeta}>
                        Generate
                    </button>
                </div>
                {paths.tts && (
                    <div className={`${softCard} p-3 text-sm`}>
                        <div className="text-slate-400 text-xs">Output</div>
                        <div>{paths.tts}</div>
                    </div>
                )}
            </div>
        </section>
    )
}

{/* Navigation */ }
<div className="flex items-center justify-between gap-4 pt-4 border-t border-white/10">
    <button className={ghostButton} onClick={goPrev} disabled={stepIndex === 0}>
        ← Previous
    </button>
    <span className="text-sm text-slate-400">Complete each step to unlock the next</span>
    <button
        className={primaryButton}
        onClick={goNext}
        disabled={stepIndex === steps.length - 1 || !nextUnlocked}
    >
        Next →
    </button>
</div>

{/* Console */ }
<section className={`${cardShell} p-4 flex flex-col gap-3`}>
    <div className="flex items-center justify-between gap-3">
        <div>
            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Console</div>
            <p className="text-sm text-slate-400">Live job output</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
            <button className={ghostButton} onClick={() => setLogs([])} disabled={logs.length === 0}>
                Clear
            </button>
            <button className={ghostButton} onClick={() => setShowLogs((prev) => !prev)}>
                {showLogs ? 'Collapse' : 'Expand'}
            </button>
        </div>
    </div>
    {showLogs ? (
        <pre className="bg-surface border border-white/10 rounded-lg p-3 text-sm max-h-[240px] overflow-auto whitespace-pre-wrap font-mono">
            {logs.length ? logs.join('\n') : 'Console idle — run a step to stream logs here.'}
        </pre>
    ) : (
        <p className="text-xs text-slate-500">Console hidden</p>
    )}
</section>
                    </div >
                </main >
            </div >
            <SanitizeDrawer
                open={sanitizeDrawerOpen}
                onClose={() => setSanitizeDrawerOpen(false)}
                result={sanitizeRun}
                instructionPlan={sanitizeInstructionPlan}
                diffNotes={sanitizeDiffNotes}
                onRerun={runSanitize}
                busy={sanitizeBusy}
                preview={previewState}
                onPlay={playPreview}
                onStop={stopPreview}
                playing={previewPlaying}
            />
            <SegmentReviewOverlay
                open={reviewOpen}
                onClose={closeSegmentReview}
                segments={sanitizeTimeline}
                currentIndex={reviewIndex}
                currentSegment={currentReviewSegment}
                nextSegment={nextReviewSegment}
                votes={reviewVotes}
                motion={reviewMotion}
                acceptedCount={acceptedCount}
                rejectedCount={rejectedCount}
                reviewComplete={reviewComplete}
                previewReady={!!sanitizeBufferRef.current}
                waveformSamples={previewWaveform}
                previewDuration={previewState.duration}
                progress={reviewProgress}
                loading={reviewLoading}
                syncing={reviewSyncState.saving}
                syncError={reviewSyncState.error}
                lastSavedAt={reviewSyncState.savedAt ?? null}
                onAccept={() => handleReviewVote('accept')}
                onReject={() => handleReviewVote('reject')}
                onBack={handleReviewBack}
                onReplay={() => {
                    if (currentReviewSegment) {
                        void playSegmentSnippet(currentReviewSegment);
                    }
                }}
                onPause={stopPreview}
                onJumpToIndex={jumpToSegment}
                onRestart={handleReviewRestart}
            />
        </div >
    );
}

type SettingControlProps = {
    label: string;
    hint: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
};

function SettingControl({ label, hint, value, min, max, step, onChange }: SettingControlProps) {
    return (
        <label className="flex flex-col gap-1 text-xs text-slate-400">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em]">
                <span>{label}</span>
                <span className="text-slate-500">{hint}</span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full accent-accent"
            />
            <div className="flex items-center gap-2 text-sm text-white">
                <span className="font-semibold">{value}</span>
                <input
                    type="number"
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-20 rounded-md border border-white/10 bg-transparent px-2 py-1 text-sm"
                />
            </div>
        </label>
    );
}

type SanitizeDrawerProps = {
    open: boolean;
    onClose: () => void;
    result: SanitizeRunMeta | null;
    instructionPlan: string[];
    diffNotes: string[];
    onRerun: () => void;
    busy: boolean;
    preview: PreviewAudioState;
    onPlay: () => void;
    onStop: () => void;
    playing: boolean;
};

function SanitizeDrawer({ open, onClose, result, instructionPlan, diffNotes, onRerun, busy, preview, onPlay, onStop, playing }: SanitizeDrawerProps) {
    const timeline = result?.previewSegments ?? [];
    const total = Math.max(1, result?.cleanDuration ?? 1);
    return (
        <div className={`fixed inset-0 z-40 transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div
                className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <aside
                className={`absolute top-0 right-0 h-full w-full max-w-5xl bg-slate-950/95 border-l border-white/5 shadow-2xl shadow-black/50 transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <header className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-4">
                    <div>
                        <div className="text-xs uppercase tracking-[0.08em] text-slate-500">Sanitize editor</div>
                        <h3 className="text-xl font-semibold text-white">Track overview</h3>
                        <p className="text-xs text-slate-400">
                            The full-resolution WAV stays on disk. This editor keeps a lightweight preview in RAM so tweaks feel instantaneous.
                        </p>
                    </div>
                    <button className="text-sm text-slate-300 hover:text-white" onClick={onClose}>
                        Close
                    </button>
                </header>
                <div className="flex h-[calc(100%-72px)]">
                    <div className="flex-1 border-r border-white/5 p-6 space-y-4 overflow-hidden">
                        <div>
                            <div className="text-xs text-slate-400 mb-2">Waveform plan</div>
                            <div className="relative h-72 rounded-2xl border border-white/10 bg-slate-900/70 overflow-hidden">
                                <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_1px,transparent_1px,transparent_70px)]" />
                                {timeline.length > 0 ? (
                                    timeline.map((seg, idx) => {
                                        const left = (seg.start / total) * 100;
                                        const width = Math.max((seg.duration / total) * 100, 0.2);
                                        const intensity = Math.min(1, Math.max(0.2, 1 - Math.abs(seg.rmsDb) / 60));
                                        return (
                                            <div
                                                key={`${seg.start}-${idx}`}
                                                className="absolute top-16 bottom-16 rounded-sm bg-accent"
                                                style={{ left: `${left}%`, width: `${width}%`, opacity: intensity }}
                                            />
                                        );
                                    })
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                                        Run sanitize to load preview data.
                                    </div>
                                )}
                                {result && (
                                    <div className="absolute inset-x-0 bottom-4 flex items-center justify-between px-6 text-xs text-slate-300">
                                        <span>{result.segments} segments</span>
                                        <span>{formatDuration(result.cleanDuration)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 space-y-3">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                                <span>Preview audio</span>
                                {preview.loading && <span className="text-accent">Loading…</span>}
                            </div>
                            {preview.error && <div className="text-xs text-rose-300">{preview.error}</div>}
                            {preview.objectUrl ? (
                                <audio controls src={preview.objectUrl} className="w-full" preload="metadata" />
                            ) : (
                                <p className="text-xs text-slate-500">No preview loaded yet.</p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span>{preview.sampleRate ? `${preview.sampleRate / 1000} kHz` : '—'}</span>
                                <span>•</span>
                                <span>{preview.duration ? formatDuration(preview.duration) : '0:00'}</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className="flex-1 px-3 py-2 rounded-lg bg-accent text-slate-950 text-sm font-semibold disabled:opacity-50"
                                    onClick={onPlay}
                                    disabled={!preview.objectUrl || busy}
                                >
                                    {playing ? 'Playing…' : 'Play RAM preview'}
                                </button>
                                <button className="px-3 py-2 rounded-lg border border-white/10 text-sm" onClick={onStop} disabled={!playing}>
                                    Stop
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="w-[360px] p-6 flex flex-col gap-4">
                        <div className={`${softCard} p-4 space-y-2`}>
                            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Instruction stack</div>
                            <ul className="text-sm space-y-1">
                                {instructionPlan.map((item) => (
                                    <li key={item} className="text-slate-200">
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className={`${softCard} p-4 space-y-2`}>
                            <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Pending diffs</div>
                            {diffNotes.length ? (
                                <ul className="text-sm space-y-1 text-amber-200">
                                    {diffNotes.map((note) => (
                                        <li key={note}>{note}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-sm text-slate-500">No parameter changes since last run.</p>
                            )}
                        </div>
                        <div className="mt-auto space-y-2">
                            <button
                                className={`${primaryButton} w-full text-center`}
                                onClick={onRerun}
                                disabled={busy || !result}
                            >
                                {busy ? 'Running…' : 'Re-run sanitize'}
                            </button>
                            <button className={`${ghostButton} w-full text-center`} onClick={onClose}>
                                Close editor
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
}

type SegmentReviewOverlayProps = {
    open: boolean;
    onClose: () => void;
    segments: SegmentPreview[];
    currentIndex: number;
    currentSegment: SegmentPreview | null;
    nextSegment: SegmentPreview | null;
    votes: ReviewVotes;
    motion: ReviewDecision | null;
    acceptedCount: number;
    rejectedCount: number;
    reviewComplete: boolean;
    previewReady: boolean;
    waveformSamples: number[];
    previewDuration: number;
    progress: number;
    loading: boolean;
    syncing: boolean;
    syncError?: string | null;
    lastSavedAt?: string | null;
    onAccept: () => void;
    onReject: () => void;
    onBack: () => void;
    onReplay: () => void;
    onPause: () => void;
    onJumpToIndex: (idx: number) => void;
    onRestart: () => void;
};

function SegmentReviewOverlay({
    open,
    onClose,
    segments,
    currentIndex,
    currentSegment,
    nextSegment,
    votes,
    motion,
    acceptedCount,
    rejectedCount,
    reviewComplete,
    previewReady,
    waveformSamples,
    previewDuration,
    progress,
    loading,
    syncing,
    syncError,
    lastSavedAt,
    onAccept,
    onReject,
    onBack,
    onReplay,
    onPause,
    onJumpToIndex,
    onRestart,
}: SegmentReviewOverlayProps) {
    const total = segments.length;
    const waveformBars = useMemo(() => {
        if (!waveformSamples.length || !previewDuration) return [] as { id: number; height: number; opacity: number }[];
        const target = 240;
        const stride = Math.max(1, Math.floor(waveformSamples.length / target));
        const bars: { id: number; height: number; opacity: number }[] = [];
        let id = 0;
        for (let i = 0; i < waveformSamples.length; i += stride) {
            const amp = Math.min(1, Math.max(0, waveformSamples[i]));
            bars.push({ id, height: 12 + amp * 88, opacity: 0.25 + amp * 0.65 });
            id += 1;
        }
        return bars;
    }, [previewDuration, waveformSamples]);

    const segmentStartPct = useMemo(() => {
        if (!currentSegment || !previewDuration) return 0;
        return Math.max(0, Math.min(100, (currentSegment.start / previewDuration) * 100));
    }, [currentSegment, previewDuration]);

    const segmentWidthPct = useMemo(() => {
        if (!currentSegment || !previewDuration) return 0;
        return Math.max(1, Math.min(100, (currentSegment.duration / previewDuration) * 100));
    }, [currentSegment, previewDuration]);

    const energy = currentSegment ? Math.min(1, Math.max(0, 1 - Math.abs(currentSegment.rmsDb) / 60)) : 0;
    const reviewActive = open && !!currentSegment && !reviewComplete && !loading;

    const progressPercent = Math.round(progress * 100);
    const voteTimeline = segments.slice(0, 60); // cap visualization for perf
    const syncLabel = loading ? 'Loading votes…' : syncing ? 'Saving…' : lastSavedAt ? `Saved ${formatTimestampLabel(lastSavedAt)}` : 'Not saved yet';

    return (
        <div className={`fixed inset-0 z-50 transition ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
            <div className="relative mx-auto mt-6 w-full max-w-5xl px-4 pb-6">
                <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl p-6 space-y-6">
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Segment review</div>
                            <h3 className="text-2xl font-semibold">Swipe to curate keeps</h3>
                            <p className="text-xs text-slate-400">Enter = keep • Space = drop • ← undo • Esc close</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-xs text-slate-300">
                            <span className={`px-3 py-1 rounded-full border ${previewReady ? 'border-emerald-400/60 text-emerald-200' : 'border-amber-400/60 text-amber-200'}`}>
                                {previewReady ? 'Preview ready' : 'Loading preview...'}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className={loading ? 'text-amber-200' : syncing ? 'text-accent' : 'text-slate-400'}>{syncLabel}</span>
                                {syncError && <span className="text-rose-300">{syncError}</span>}
                            </div>
                            <button className="text-slate-400 hover:text-white" onClick={onClose}>Close</button>
                        </div>
                    </header>

                    <div className="space-y-3">
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-rose-400 via-accent to-emerald-400 transition-all" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                        </div>
                        {total > 0 && (
                            <>
                                <div className="text-xs flex items-center justify-between text-slate-400">
                                    <span>{Math.min(currentIndex + 1, total)} / {total} segments</span>
                                    <span>
                                        <span className="text-emerald-300">{acceptedCount} keep</span>
                                        <span className="text-slate-600 mx-1">•</span>
                                        <span className="text-rose-300">{rejectedCount} drop</span>
                                    </span>
                                </div>
                                <div className="flex gap-1 h-1.5">
                                    {voteTimeline.map((_, idx) => {
                                        const decision = votes[idx];
                                        const base = idx === currentIndex && !reviewComplete ? 'bg-white/70' : 'bg-white/10';
                                        const color = decision === 'accept' ? 'bg-emerald-400/80' : decision === 'reject' ? 'bg-rose-400/70' : base;
                                        return <span key={idx} className={`flex-1 rounded-full transition-colors duration-200 ${color}`} />;
                                    })}
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-slate-500">
                                        <span>All segments</span>
                                        <span>tap to jump</span>
                                    </div>
                                    <div
                                        className="grid gap-[3px] rounded-lg border border-slate-700 bg-slate-900 p-2 max-h-40 overflow-auto"
                                        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(9px, 1fr))', gridAutoRows: '14px' }}
                                    >
                                        {segments.map((seg, idx) => {
                                            const decision = votes[idx];
                                            const color = decision === 'accept' ? 'bg-emerald-400/80' : decision === 'reject' ? 'bg-rose-400/70' : 'bg-white/20';
                                            const ring = idx === currentIndex && !reviewComplete ? 'ring-2 ring-white/80' : '';
                                            return (
                                                <button
                                                    key={`${seg.start}-${idx}`}
                                                    type="button"
                                                    onClick={() => onJumpToIndex(idx)}
                                                    className={`h-[10px] min-h-[10px] min-w-[9px] ${color} ${ring} rounded-[2px] transition focus:outline-none focus:ring-2 focus:ring-accent`}
                                                    title={`#${idx + 1} ${formatDuration(seg.start)} → ${formatDuration(seg.end)}`}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {total === 0 && (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center text-slate-400 space-y-3">
                            <p>No segments yet. Run sanitize to unlock swipe review.</p>
                            <button className={ghostButton} onClick={onClose}>Close</button>
                        </div>
                    )}

                    {total > 0 && (
                        <div className="grid lg:grid-cols-[2fr,1fr] gap-5 items-start">
                            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/70 to-slate-800 p-5 space-y-4">
                                {currentSegment ? (
                                    <>
                                        {motion && (
                                            <span className={`inline-flex px-3 py-1 rounded-full border text-xs font-semibold tracking-[0.3em] ${motion === 'accept' ? 'border-emerald-400 text-emerald-200' : 'border-rose-400 text-rose-200'}`}>
                                                {motion === 'accept' ? 'KEEP' : 'DROP'}
                                            </span>
                                        )}
                                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Segment {currentIndex + 1}</div>
                                        <h4 className="text-3xl font-semibold text-white">
                                            {formatDuration(currentSegment.start)} → {formatDuration(currentSegment.end)}
                                        </h4>
                                        <p className="text-sm text-slate-400">{currentSegment.duration.toFixed(1)}s clip · {currentSegment.rmsDb.toFixed(1)} dB RMS</p>
                                        <div className="space-y-2">
                                            <div className="text-xs text-slate-400">Energy</div>
                                            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400" style={{ width: `${Math.max(12, energy * 100)}%` }} />
                                            </div>
                                        </div>
                                        {nextSegment && (
                                            <div className="text-xs text-slate-400">
                                                Next: {formatDuration(nextSegment.start)} → {formatDuration(nextSegment.end)}
                                            </div>
                                        )}
                                        <div className="relative mt-4 h-40 rounded-2xl border border-white/10 bg-slate-900/80 overflow-hidden">
                                            <div className="absolute inset-0 opacity-30 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_1px,transparent_1px,transparent_60px)]" />
                                            {currentSegment && previewDuration > 0 && (
                                                <div
                                                    className="absolute inset-y-2 rounded-lg border border-emerald-400/60 bg-emerald-400/10"
                                                    style={{ left: `${segmentStartPct}%`, width: `${segmentWidthPct}%` }}
                                                />
                                            )}
                                            {waveformBars.length ? (
                                                <div className="absolute inset-3 flex items-end gap-[1px]">
                                                    {waveformBars.map((bar) => (
                                                        <span
                                                            key={bar.id}
                                                            className="flex-1 rounded-t bg-white"
                                                            style={{ height: `${bar.height}%`, opacity: bar.opacity }}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                                                    Preview waveform not ready
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-slate-400">No active segment.</div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className={`${softCard} p-4 space-y-3`}>
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span>Controls</span>
                                        <span>{previewReady ? 'Preview linked' : 'Waiting for preview'}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs text-slate-200">
                                        <span className="px-3 py-1 rounded-lg border border-white/10 bg-white/5">Enter → keep</span>
                                        <span className="px-3 py-1 rounded-lg border border-white/10 bg-white/5">Space → drop</span>
                                        <span className="px-3 py-1 rounded-lg border border-white/10 bg-white/5">← undo</span>
                                        <span className="px-3 py-1 rounded-lg border border-white/10 bg-white/5">Esc close</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button className={ghostButton} onClick={onBack} disabled={currentIndex === 0}>Back</button>
                                        <button className={ghostButton} onClick={onReplay} disabled={!reviewActive}>Replay</button>
                                        <button className={ghostButton} onClick={onPause} disabled={!previewReady}>Pause</button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <button
                                        className="w-full px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 via-lime-300 to-emerald-400 text-slate-900 font-semibold text-lg shadow-lg shadow-emerald-500/40 transition hover:-translate-y-0.5 disabled:opacity-40"
                                        onClick={onAccept}
                                        disabled={!reviewActive}
                                    >
                                        Keep (Enter)
                                    </button>
                                    <button
                                        className="w-full px-4 py-3 rounded-2xl border border-rose-400/60 text-rose-100 font-semibold text-lg bg-rose-950/50 shadow-lg shadow-rose-500/20 transition hover:-translate-y-0.5 disabled:opacity-40"
                                        onClick={onReject}
                                        disabled={!reviewActive}
                                    >
                                        Drop (Space)
                                    </button>
                                    <button className={ghostButton} onClick={onRestart} disabled={loading}>Restart review</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

type MiniStepperProps = {
    steps: StepDefinition[];
    flow: Record<StepId, StepState>;
    current: StepId;
    isUnlocked: (id: StepId) => boolean;
    onSelect: (id: StepId) => void;
};

function MiniStepper({ steps, flow, current, isUnlocked, onSelect }: MiniStepperProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {steps.map((s, idx) => {
                const state = flow[s.id];
                const unlocked = isUnlocked(s.id);
                const active = current === s.id;
                const status = state?.status ?? 'idle';
                const pillTone = status === 'running' ? 'text-accent border-accent/50' : status === 'done' ? 'text-emerald-200 border-emerald-400/60' : status === 'error' ? 'text-rose-200 border-rose-400/60' : 'text-slate-300 border-white/10';
                return (
                    <button
                        key={s.id}
                        onClick={() => unlocked && onSelect(s.id)}
                        disabled={!unlocked}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${active
                            ? 'bg-white/5 border-accent/60 shadow-md shadow-accent/20'
                            : unlocked
                                ? 'bg-panel/70 hover:border-accent/40 border-white/10'
                                : 'bg-panel/60 border-white/10 opacity-50 cursor-not-allowed'
                            }`}
                    >
                        <span className={`w-9 h-9 rounded-lg border bg-white/5 grid place-items-center text-sm font-semibold ${pillTone}`}>
                            {idx + 1}
                        </span>
                        <div className="min-w-0">
                            <div className="font-semibold truncate">{s.title}</div>
                            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500 truncate">{unlocked ? s.sub : 'Locked'}</div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

type StatusPillProps = { state?: StepState };

function StatusPill({ state }: StatusPillProps) {
    if (!state || state.status === 'idle') return null;
    const tone = state.status === 'running' ? 'border-accent text-accent' : state.status === 'error' ? 'border-rose-400 text-rose-200' : 'border-emerald-400 text-emerald-200';
    const label = state.status === 'running' ? 'Running' : state.status === 'error' ? 'Error' : 'Ready';
    return <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${tone}`}>{label}</span>;
}

type ConsolePanelProps = {
    logs: string[];
    show: boolean;
    follow: boolean;
    onToggle: () => void;
    onToggleFollow: () => void;
    onClear: () => void;
    panelRef: MutableRefObject<HTMLPreElement | null>;
    className?: string;
};

function ConsolePanel({ logs, show, follow, onToggle, onToggleFollow, onClear, panelRef, className }: ConsolePanelProps) {
    return (
        <section className={`${cardShell} p-4 flex flex-col gap-3 ${className ?? ''}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Console</div>
                    <p className="text-sm text-slate-400">Live job output</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs justify-end">
                    <button className={ghostButton} onClick={onClear} disabled={logs.length === 0}>
                        Clear
                    </button>
                    <button className={ghostButton} onClick={onToggleFollow}>
                        {follow ? 'Follow on' : 'Follow off'}
                    </button>
                    <button className={ghostButton} onClick={onToggle}>
                        {show ? 'Collapse' : 'Expand'}
                    </button>
                </div>
            </div>
            {show ? (
                <pre
                    ref={panelRef}
                    className="bg-surface border border-white/10 rounded-lg p-3 text-sm max-h-[260px] overflow-auto whitespace-pre-wrap font-mono"
                >
                    {logs.length ? logs.join('\n') : 'Console idle — run a step to stream logs here.'}
                </pre>
            ) : (
                <p className="text-xs text-slate-500">Console hidden</p>
            )}
        </section>
    );
}

function buildWaveform(buffer: AudioBuffer, targetSamples = 800): number[] {
    if (!buffer) return [];
    const channel = buffer.getChannelData(0);
    if (!channel?.length) return [];
    const stride = Math.max(1, Math.floor(channel.length / targetSamples));
    const samples: number[] = [];
    for (let i = 0; i < channel.length; i += stride) {
        let peak = 0;
        for (let j = 0; j < stride && i + j < channel.length; j++) {
            peak = Math.max(peak, Math.abs(channel[i + j]));
        }
        samples.push(Math.min(1, peak));
    }
    return samples;
}

function reviewSignatureKey(votes: ReviewVotes, length: number): string {
    const ordered = Array.from({ length }, (_, idx) => votes[idx] ?? '-');
    return ordered.join('');
}

function formatSeconds(seconds: number): string {
    return formatDuration(seconds);
}

function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return '0:00';
    }
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const mm = mins.toString().padStart(2, '0');
    const ss = secs.toString().padStart(2, '0');
    return hrs ? `${hrs}:${mm}:${ss}` : `${mins}:${ss}`;
}

function formatTimestampLabel(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

