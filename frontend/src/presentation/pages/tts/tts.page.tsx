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
    datasetPath?: string | null;
    status: string;
    createdAt?: string | null;
    vodUrl?: string | null;
    clipsCount: number;
    latestTtsPath?: string | null;
    hasTrainArtifacts: boolean;
    params?: Record<string, unknown>;
    stats?: {
        total_segments?: number;
        kept_segments?: number;
        total_duration?: number;
        clean_duration?: number;
        rejection_reasons?: Record<string, number>;
    };
};

type TtsResult = {
    outputPath: string;
    log: string[];
};

type TtsPayload = {
    vodUrl: string;
    runId: string;
    streamer: string;
    text: string;
    sourceMode: 'all_streamer' | 'target_dataset';
    targetDatasetPath?: string;
    qualityPreset: 'fast' | 'balanced' | 'best';
    acceptedOnly: boolean;
    advancedMode?: boolean;
    targetSeconds?: number;
    maxPerRun?: number;
    minSpeakerSim?: number;
    minClipSec?: number;
    maxClipSec?: number;
    maxClips?: number;
    speakerClipCount?: number;
    model?: string;
    language?: string;
    device?: 'auto' | 'cpu' | 'cuda';
    cpuThreads?: number;
    cudaBenchmark?: boolean;
    temperature?: number;
    topP?: number;
    topK?: number;
    speed?: number;
    repetitionPenalty?: number;
    lengthPenalty?: number;
};

type TtsStreamEvent = {
    type: string;
    line?: string;
    error?: string;
    outputPath?: string;
};

const MAX_LOG_LINES = 240;

const appendLog = (current: string[], line: string): string[] => {
    const next = [...current, line];
    if (next.length <= MAX_LOG_LINES) return next;
    return next.slice(-MAX_LOG_LINES);
};

const inferProgressFromLine = (line: string): number | null => {
    const directPercent = line.match(/(\d{1,3})%/);
    if (directPercent) {
        const value = Number(directPercent[1]);
        if (Number.isFinite(value) && value >= 0 && value <= 100) {
            return value;
        }
    }

    const normalized = line.toLowerCase();
    if (normalized.includes('starting tts generation')) return 5;
    if (normalized.includes('speaker dataset')) return 10;
    if (normalized.includes('installing xtts dependencies')) return 20;
    if (normalized.includes('running:')) return 30;
    if (normalized.includes('model=')) return 55;
    if (normalized.includes('using model: xtts')) return 65;
    if (normalized.includes('text splitted to sentences')) return 78;
    if (normalized.includes('processing time')) return 88;
    if (normalized.includes('[tts-script] done')) return 98;
    if (normalized.includes('success')) return 100;
    return null;
};

const isNetworkLikeError = (error: unknown): boolean => {
    const message = (error as Error)?.message?.toLowerCase() ?? '';
    return (
        message.includes('network') ||
        message.includes('failed to fetch') ||
        message.includes('load failed')
    );
};

const parseOptionalNumber = (value: string, min?: number, max?: number): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return undefined;
    if (min !== undefined && parsed < min) return min;
    if (max !== undefined && parsed > max) return max;
    return parsed;
};

const formatDate = (value?: string | null): string => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
};

const formatSeconds = (value?: number): string => {
    if (!Number.isFinite(value)) return '—';
    const totalSeconds = Math.max(0, Math.round(value ?? 0));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const artifactUrl = (path: string) =>
    `${config.apiBaseUrl}/legacy/artifact?path=${encodeURIComponent(path)}`;

type SourceKey = 'twitch' | 'youtube' | 'other';

const detectSource = (vodUrl?: string | null): SourceKey => {
    if (!vodUrl) return 'other';
    const normalized = vodUrl.toLowerCase();
    if (normalized.includes('twitch.tv')) return 'twitch';
    if (normalized.includes('youtube.com') || normalized.includes('youtu.be')) return 'youtube';
    return 'other';
};

const sourceLabel: Record<SourceKey, string> = {
    twitch: 'Twitch',
    youtube: 'YouTube',
    other: 'Other',
};

const streamerAvatarUrl = (streamer: string, source: SourceKey): string => {
    const encoded = encodeURIComponent(streamer);
    if (source === 'twitch') return `https://unavatar.io/twitch/${encoded}`;
    if (source === 'youtube') return `https://unavatar.io/youtube/${encoded}`;
    return `https://api.dicebear.com/9.x/initials/svg?seed=${encoded}`;
};

export const TtsPage: React.FC = () => {
    const [streamers, setStreamers] = useState<StreamerSummary[]>([]);
    const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
    const [selectedStreamer, setSelectedStreamer] = useState<string>('');
    const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
    const [ttsSourceMode, setTtsSourceMode] = useState<'all_streamer' | 'target_dataset'>('all_streamer');
    const [ttsQualityPreset, setTtsQualityPreset] = useState<'fast' | 'balanced' | 'best'>('balanced');
    const [ttsAcceptedOnly, setTtsAcceptedOnly] = useState(false);
    const [advancedMode, setAdvancedMode] = useState(false);
    const [advancedTargetSeconds, setAdvancedTargetSeconds] = useState('120');
    const [advancedMaxPerRun, setAdvancedMaxPerRun] = useState('8');
    const [advancedMinSpeakerSim, setAdvancedMinSpeakerSim] = useState('0.15');
    const [advancedMinClipSec, setAdvancedMinClipSec] = useState('2');
    const [advancedMaxClipSec, setAdvancedMaxClipSec] = useState('10');
    const [advancedMaxClips, setAdvancedMaxClips] = useState('64');
    const [advancedSpeakerClipCount, setAdvancedSpeakerClipCount] = useState('24');
    const [advancedModel, setAdvancedModel] = useState('xtts_v2');
    const [advancedLanguage, setAdvancedLanguage] = useState('en');
    const [advancedDevice, setAdvancedDevice] = useState<'auto' | 'cpu' | 'cuda'>('auto');
    const [advancedCpuThreads, setAdvancedCpuThreads] = useState('16');
    const [advancedCudaBenchmark, setAdvancedCudaBenchmark] = useState(true);
    const [advancedTemperature, setAdvancedTemperature] = useState('0.65');
    const [advancedTopP, setAdvancedTopP] = useState('0.9');
    const [advancedTopK, setAdvancedTopK] = useState('50');
    const [advancedSpeed, setAdvancedSpeed] = useState('1.0');
    const [advancedRepetitionPenalty, setAdvancedRepetitionPenalty] = useState('2.0');
    const [advancedLengthPenalty, setAdvancedLengthPenalty] = useState('1.0');
    const [ttsText, setTtsText] = useState<string>(
        'Hey chat, witajcie! Dzisiaj robimy nowy challenge i lecimy ostro z contentem.'
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<number | null>(null);
    const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null);
    const [etaTick, setEtaTick] = useState(0);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [generationLog, setGenerationLog] = useState<string[]>([]);
    const [outputPath, setOutputPath] = useState<string | null>(null);

    useEffect(() => {
        if (!isGenerating) return;
        const interval = window.setInterval(() => setEtaTick((value) => value + 1), 1000);
        return () => window.clearInterval(interval);
    }, [isGenerating]);

    const legacyRequest = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
        const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
        const response = await fetch(`${baseUrl}/legacy${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                ...(init.headers || {}),
            },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            const detail = (payload as { detail?: string }).detail || response.statusText;
            throw new Error(detail);
        }
        return payload as T;
    }, []);

    const runStreamingTts = useCallback(
        async (payload: TtsPayload): Promise<string> => {
            const baseUrl = config.apiBaseUrl.replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/legacy/tts/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, stream: true }),
            });

            if (!response.ok || !response.body) {
                const body = await response.json().catch(() => ({}));
                const detail = (body as { detail?: string }).detail || response.statusText;
                throw new Error(detail || 'Streaming TTS failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let finishedOutputPath: string | null = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    const evt = JSON.parse(trimmed) as TtsStreamEvent;

                    if (evt.type === 'log' && evt.line) {
                        setGenerationLog((previous) => appendLog(previous, evt.line as string));
                        const inferred = inferProgressFromLine(evt.line);
                        if (inferred !== null) {
                            setGenerationProgress((previous) =>
                                Math.max(previous ?? 0, Math.min(99, inferred))
                            );
                        }
                    }

                    if (evt.type === 'error') {
                        throw new Error(evt.error || 'TTS generation failed');
                    }

                    if (evt.type === 'done') {
                        finishedOutputPath = evt.outputPath || null;
                        setGenerationProgress(100);
                    }
                }
            }

            if (!finishedOutputPath) {
                throw new Error('TTS finished without output path');
            }

            return finishedOutputPath;
        },
        []
    );

    const runNonStreamingTts = useCallback(
        async (payload: TtsPayload): Promise<TtsResult> => {
            setGenerationLog((previous) =>
                appendLog(
                    previous,
                    `[${new Date().toLocaleTimeString()}] Streaming unavailable, fallback to standard mode...`
                )
            );
            setGenerationProgress((previous) => Math.max(previous ?? 0, 25));
            const result = await legacyRequest<TtsResult>('/tts/run', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            setGenerationLog(result.log || []);
            setGenerationProgress(100);
            return result;
        },
        [legacyRequest]
    );

    const fetchTtsContext = useCallback(
        async (refresh = false, explicitStreamer = '') => {
            setLoading(true);
            setError(null);
            try {
                const refreshQuery = refresh ? '&refresh=true' : '';
                const streamerPayload = await legacyRequest<{ items: StreamerSummary[] }>(
                    `/datasets/streamers?datasetOut=dataset&outdir=out${refreshQuery}`
                );

                const streamerQuery = explicitStreamer
                    ? `&streamer=${encodeURIComponent(explicitStreamer)}`
                    : '';

                const datasetPayload = await legacyRequest<{ items: DatasetRecord[] }>(
                    `/datasets?datasetOut=dataset&outdir=out${streamerQuery}${refreshQuery}`
                );

                setStreamers(streamerPayload.items || []);
                setDatasets(datasetPayload.items || []);

                if (!explicitStreamer && streamerPayload.items?.length) {
                    setSelectedStreamer(streamerPayload.items[0].streamer);
                    return;
                }

                if (datasetPayload.items.length > 0) {
                    setSelectedDatasetId((previous) => {
                        const hasCurrent = datasetPayload.items.some(
                            (item) => item.datasetId === previous
                        );
                        return hasCurrent ? previous : datasetPayload.items[0].datasetId;
                    });
                } else {
                    setSelectedDatasetId('');
                }
            } catch (requestError) {
                setError((requestError as Error).message);
            } finally {
                setLoading(false);
            }
        },
        [legacyRequest]
    );

    useEffect(() => {
        void fetchTtsContext(false, '');
    }, [fetchTtsContext]);

    useEffect(() => {
        if (!selectedStreamer) return;
        void fetchTtsContext(false, selectedStreamer);
    }, [selectedStreamer, fetchTtsContext]);

    const selectedDataset = useMemo(
        () => datasets.find((item) => item.datasetId === selectedDatasetId) ?? null,
        [datasets, selectedDatasetId]
    );

    const selectedStreamerSummary = useMemo(
        () => streamers.find((item) => item.streamer === selectedStreamer) ?? null,
        [selectedStreamer, streamers]
    );

    const selectedStreamerDatasets = useMemo(
        () => datasets.filter((item) => item.streamer === selectedStreamer),
        [datasets, selectedStreamer]
    );

    const selectedTargetDataset = useMemo(
        () => selectedStreamerDatasets.find((item) => item.datasetId === selectedDatasetId) ?? null,
        [selectedStreamerDatasets, selectedDatasetId]
    );

    const effectiveVodUrl = useMemo(() => {
        if (ttsSourceMode === 'target_dataset') {
            return selectedTargetDataset?.vodUrl ?? '';
        }
        return selectedStreamerDatasets.find((item) => Boolean(item.vodUrl))?.vodUrl ?? '';
    }, [ttsSourceMode, selectedTargetDataset, selectedStreamerDatasets]);

    const effectiveRunId = useMemo(() => {
        if (ttsSourceMode === 'target_dataset') {
            return selectedTargetDataset?.runId ?? '';
        }
        return selectedStreamerDatasets.find((item) => Boolean(item.runId))?.runId ?? '';
    }, [ttsSourceMode, selectedTargetDataset, selectedStreamerDatasets]);

    const sourceBreakdown = useMemo(() => {
        const counts: Record<SourceKey, number> = { twitch: 0, youtube: 0, other: 0 };
        for (const item of selectedStreamerDatasets) {
            counts[detectSource(item.vodUrl)] += 1;
        }
        return counts;
    }, [selectedStreamerDatasets]);

    const primarySource = useMemo<SourceKey>(() => {
        if (sourceBreakdown.twitch >= sourceBreakdown.youtube && sourceBreakdown.twitch > 0) {
            return 'twitch';
        }
        if (sourceBreakdown.youtube > 0) {
            return 'youtube';
        }
        return 'other';
    }, [sourceBreakdown]);

    const streamerResources = useMemo(() => {
        if (!selectedStreamer) {
            return {
                totalDatasets: 0,
                totalRuns: 0,
                totalClips: 0,
                totalKeptSegments: 0,
                totalCleanDuration: 0,
            };
        }

        const related = datasets.filter((item) => item.streamer === selectedStreamer);
        return {
            totalDatasets: related.length,
            totalRuns: related.filter((item) => Boolean(item.runId)).length,
            totalClips: related.reduce((sum, item) => sum + (item.clipsCount || 0), 0),
            totalKeptSegments: related.reduce(
                (sum, item) => sum + Number(item.stats?.kept_segments || 0),
                0
            ),
            totalCleanDuration: related.reduce(
                (sum, item) => sum + Number(item.stats?.clean_duration || 0),
                0
            ),
        };
    }, [datasets, selectedStreamer]);

    const rejectionReasons = useMemo(() => {
        const reasons = selectedDataset?.stats?.rejection_reasons || {};
        return Object.entries(reasons).sort((a, b) => b[1] - a[1]);
    }, [selectedDataset]);

    const canGenerate =
        !isGenerating &&
        Boolean(selectedStreamer) &&
        Boolean(effectiveVodUrl) &&
        Boolean(effectiveRunId) &&
        (ttsSourceMode !== 'target_dataset' || Boolean(selectedTargetDataset?.datasetPath)) &&
        ttsText.trim().length > 0;

    const resetAdvancedDefaults = useCallback(() => {
        setAdvancedTargetSeconds('120');
        setAdvancedMaxPerRun('8');
        setAdvancedMinSpeakerSim('0.15');
        setAdvancedMinClipSec('2');
        setAdvancedMaxClipSec('10');
        setAdvancedMaxClips('64');
        setAdvancedSpeakerClipCount('24');
        setAdvancedModel('xtts_v2');
        setAdvancedLanguage('en');
        setAdvancedDevice('cuda');
        setAdvancedCpuThreads('16');
        setAdvancedCudaBenchmark(true);
        setAdvancedTemperature('0.65');
        setAdvancedTopP('0.9');
        setAdvancedTopK('50');
        setAdvancedSpeed('1.0');
        setAdvancedRepetitionPenalty('2.0');
        setAdvancedLengthPenalty('1.0');
    }, []);

    const applyAdvancedPreset = useCallback((preset: 'SAFE' | 'QUALITY' | 'SPEED') => {
        if (preset === 'SAFE') {
            setAdvancedTargetSeconds('100');
            setAdvancedMaxPerRun('6');
            setAdvancedMinSpeakerSim('0.2');
            setAdvancedMinClipSec('2');
            setAdvancedMaxClipSec('8');
            setAdvancedMaxClips('48');
            setAdvancedSpeakerClipCount('16');
            setAdvancedModel('xtts_v2');
            setAdvancedLanguage('en');
            setAdvancedDevice('cuda');
            setAdvancedCpuThreads('16');
            setAdvancedCudaBenchmark(true);
            setAdvancedTemperature('0.55');
            setAdvancedTopP('0.8');
            setAdvancedTopK('40');
            setAdvancedSpeed('1.0');
            setAdvancedRepetitionPenalty('2.2');
            setAdvancedLengthPenalty('1.0');
            return;
        }

        if (preset === 'QUALITY') {
            setAdvancedTargetSeconds('180');
            setAdvancedMaxPerRun('12');
            setAdvancedMinSpeakerSim('0.15');
            setAdvancedMinClipSec('1.5');
            setAdvancedMaxClipSec('12');
            setAdvancedMaxClips('128');
            setAdvancedSpeakerClipCount('32');
            setAdvancedModel('xtts_v2');
            setAdvancedLanguage('en');
            setAdvancedDevice('cuda');
            setAdvancedCpuThreads('16');
            setAdvancedCudaBenchmark(true);
            setAdvancedTemperature('0.65');
            setAdvancedTopP('0.9');
            setAdvancedTopK('60');
            setAdvancedSpeed('0.98');
            setAdvancedRepetitionPenalty('2.0');
            setAdvancedLengthPenalty('1.0');
            return;
        }

        setAdvancedTargetSeconds('70');
        setAdvancedMaxPerRun('4');
        setAdvancedMinSpeakerSim('0.1');
        setAdvancedMinClipSec('2.5');
        setAdvancedMaxClipSec('7');
        setAdvancedMaxClips('32');
        setAdvancedSpeakerClipCount('12');
        setAdvancedModel('xtts_v2');
        setAdvancedLanguage('en');
        setAdvancedDevice('cuda');
        setAdvancedCpuThreads('16');
        setAdvancedCudaBenchmark(true);
        setAdvancedTemperature('0.7');
        setAdvancedTopP('0.9');
        setAdvancedTopK('30');
        setAdvancedSpeed('1.08');
        setAdvancedRepetitionPenalty('1.8');
        setAdvancedLengthPenalty('0.95');
    }, []);

    const etaLabel = useMemo(() => {
        if (!isGenerating || generationProgress === null || generationStartedAt === null) {
            return null;
        }
        if (generationProgress <= 1 || generationProgress >= 100) {
            return null;
        }

        const elapsedSeconds = Math.max(1, Math.floor((Date.now() - generationStartedAt) / 1000));
        const totalEstimatedSeconds = Math.floor(elapsedSeconds / (generationProgress / 100));
        const remainingSeconds = Math.max(0, totalEstimatedSeconds - elapsedSeconds);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }, [isGenerating, generationProgress, generationStartedAt, etaTick]);

    const handleGenerate = async () => {
        if (!selectedStreamer) return;
        if (!effectiveVodUrl) {
            setGenerationError('Brak vodUrl do uruchomienia TTS. Wybierz run z poprawnym VOD.');
            return;
        }
        if (!effectiveRunId) {
            setGenerationError('Brak runId do uruchomienia TTS. Wybierz dataset przypięty do runu.');
            return;
        }
        if (ttsSourceMode === 'target_dataset' && !selectedTargetDataset?.datasetPath) {
            setGenerationError('Tryb target dataset wymaga wyboru konkretnego datasetu z clips.');
            return;
        }

        setIsGenerating(true);
        setGenerationProgress(0);
        setGenerationStartedAt(Date.now());
        setGenerationError(null);
        setOutputPath(null);
        setGenerationLog([]);

        try {
            const payload = {
                vodUrl: effectiveVodUrl,
                runId: effectiveRunId,
                streamer: selectedStreamer,
                text: ttsText.trim(),
                sourceMode: ttsSourceMode,
                targetDatasetPath:
                    ttsSourceMode === 'target_dataset'
                        ? selectedTargetDataset?.datasetPath || undefined
                        : undefined,
                qualityPreset: ttsQualityPreset,
                acceptedOnly: ttsAcceptedOnly,
                advancedMode,
                ...(advancedMode
                    ? {
                        targetSeconds: parseOptionalNumber(advancedTargetSeconds, 10, 600),
                        maxPerRun: parseOptionalNumber(advancedMaxPerRun, 1, 64),
                        minSpeakerSim: parseOptionalNumber(advancedMinSpeakerSim, 0, 1),
                        minClipSec: parseOptionalNumber(advancedMinClipSec, 0, 30),
                        maxClipSec: parseOptionalNumber(advancedMaxClipSec, 0, 60),
                        maxClips: parseOptionalNumber(advancedMaxClips, 1, 2000),
                        speakerClipCount: parseOptionalNumber(advancedSpeakerClipCount, 1, 128),
                        model: advancedModel.trim() || undefined,
                        language: advancedLanguage.trim() || undefined,
                        device: advancedDevice,
                        cpuThreads: parseOptionalNumber(advancedCpuThreads, 1, 64),
                        cudaBenchmark: advancedCudaBenchmark,
                        temperature: parseOptionalNumber(advancedTemperature, 0, 2),
                        topP: parseOptionalNumber(advancedTopP, 0, 1),
                        topK: parseOptionalNumber(advancedTopK, 0, 200),
                        speed: parseOptionalNumber(advancedSpeed, 0.5, 2),
                        repetitionPenalty: parseOptionalNumber(advancedRepetitionPenalty, 0.5, 3),
                        lengthPenalty: parseOptionalNumber(advancedLengthPenalty, 0.2, 3),
                    }
                    : {}),
            };

            setGenerationLog((previous) =>
                appendLog(
                    previous,
                    `[client] advancedMode=${advancedMode} speakerClipCount=${advancedMode ? parseOptionalNumber(advancedSpeakerClipCount, 1, 128) ?? 'auto' : 'auto'
                    } device=${advancedMode ? advancedDevice : 'auto'} targetSeconds=${advancedMode ? parseOptionalNumber(advancedTargetSeconds, 10, 600) ?? 'preset' : 'preset'
                    }`
                )
            );

            let finishedOutputPath: string;
            try {
                finishedOutputPath = await runStreamingTts(payload);
            } catch (streamError) {
                if (!isNetworkLikeError(streamError)) {
                    throw streamError;
                }
                const fallbackResult = await runNonStreamingTts(payload);
                finishedOutputPath = fallbackResult.outputPath;
            }

            setOutputPath(finishedOutputPath);
            await fetchTtsContext(true, selectedStreamer);
        } catch (requestError) {
            const message = (requestError as Error).message;
            setGenerationError(message);
            setGenerationProgress(null);
            setGenerationStartedAt(null);
            setGenerationLog((previous) => {
                let next = appendLog(previous, `[${new Date().toLocaleTimeString()}] TTS failed`);
                next = appendLog(next, `[${new Date().toLocaleTimeString()}] ${message}`);
                return next;
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="glass rounded-2xl p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">TTS Generator</h1>
                    <p className="text-sm text-slate-400">
                        Wybierz streamera i dataset, sprawdź dane treningowe, a potem wygeneruj tekst.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void fetchTtsContext(true, selectedStreamer || '')}
                    className="secondary-btn px-4 py-2 rounded-lg text-sm font-semibold"
                    disabled={loading}
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {error && <div className="glass rounded-2xl p-4 text-sm text-red-300">{error}</div>}

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="glass rounded-2xl p-4 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Wybór streamera i datasetu</h2>

                    {selectedStreamer && (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3 flex items-center gap-3">
                            <img
                                src={streamerAvatarUrl(selectedStreamer, primarySource)}
                                alt={`${selectedStreamer} avatar`}
                                className="h-12 w-12 rounded-full border border-white/20 object-cover bg-slate-800"
                                loading="lazy"
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{selectedStreamer}</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                    {(Object.keys(sourceBreakdown) as SourceKey[])
                                        .filter((key) => sourceBreakdown[key] > 0)
                                        .map((key) => (
                                            <span
                                                key={key}
                                                className="text-xs px-2 py-1 rounded-md border border-white/15 text-slate-200"
                                            >
                                                {sourceLabel[key]} ({sourceBreakdown[key]})
                                            </span>
                                        ))}
                                    {selectedStreamerDatasets.length === 0 && (
                                        <span className="text-xs px-2 py-1 rounded-md border border-white/15 text-slate-400">
                                            No source data
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wide text-slate-400">Streamer</label>
                        <select
                            value={selectedStreamer}
                            onChange={(event) => setSelectedStreamer(event.target.value)}
                            className="w-full rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                        >
                            <option value="">Wybierz streamera</option>
                            {streamers.map((item) => (
                                <option key={item.streamer} value={item.streamer}>
                                    {item.streamer} (datasets: {item.datasets}, runs: {item.runs})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300 grid gap-2 sm:grid-cols-2">
                        <div>Datasety: <span className="text-white">{streamerResources.totalDatasets}</span></div>
                        <div>Runy: <span className="text-white">{streamerResources.totalRuns}</span></div>
                        <div>Clips łącznie: <span className="text-white">{streamerResources.totalClips}</span></div>
                        <div>
                            Kept segments: <span className="text-white">{streamerResources.totalKeptSegments}</span>
                        </div>
                        <div className="sm:col-span-2">
                            Czyste audio łącznie: <span className="text-white">{formatSeconds(streamerResources.totalCleanDuration)}</span>
                        </div>
                    </div>

                    {selectedStreamerSummary && (
                        <div className="text-xs text-slate-400 space-y-1">
                            <div>Ostatni run: <span className="text-slate-200">{formatDate(selectedStreamerSummary.latestRunAt)}</span></div>
                            {selectedStreamerSummary.latestTtsPath && (
                                <div>
                                    Ostatnie TTS:{' '}
                                    <a
                                        className="text-cyan-300 hover:text-cyan-200"
                                        href={artifactUrl(selectedStreamerSummary.latestTtsPath)}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        otwórz plik
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="glass rounded-2xl p-4 space-y-4">
                    <h2 className="text-lg font-semibold text-white">Dane treningowe</h2>

                    {selectedDataset ? (
                        <>
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300 grid gap-2 sm:grid-cols-2">
                                <div>Status: <span className="text-white">{selectedDataset.status}</span></div>
                                <div>Run: <span className="text-white">{selectedDataset.runId || 'legacy'}</span></div>
                                <div>Source: <span className="text-white">{sourceLabel[detectSource(selectedDataset.vodUrl)]}</span></div>
                                <div>VOD URL: <span className="text-white">{selectedDataset.vodUrl ? 'available' : 'missing'}</span></div>
                                <div>Total segments: <span className="text-white">{selectedDataset.stats?.total_segments ?? '—'}</span></div>
                                <div>Kept segments: <span className="text-white">{selectedDataset.stats?.kept_segments ?? '—'}</span></div>
                                <div>Total duration: <span className="text-white">{formatSeconds(selectedDataset.stats?.total_duration)}</span></div>
                                <div>Clean duration: <span className="text-white">{formatSeconds(selectedDataset.stats?.clean_duration)}</span></div>
                                <div>Train artifacts: <span className="text-white">{selectedDataset.hasTrainArtifacts ? 'yes' : 'no'}</span></div>
                                <div>Clips: <span className="text-white">{selectedDataset.clipsCount}</span></div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Parametry sanitizacji / treningu</p>
                                <pre className="max-h-36 overflow-auto text-xs text-slate-300 whitespace-pre-wrap">
                                    {JSON.stringify(selectedDataset.params || {}, null, 2)}
                                </pre>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Powody odrzuceń segmentów</p>
                                {rejectionReasons.length === 0 ? (
                                    <p className="text-sm text-slate-400">Brak danych odrzuceń.</p>
                                ) : (
                                    <ul className="space-y-1 text-sm text-slate-300">
                                        {rejectionReasons.map(([reason, count]) => (
                                            <li key={reason} className="flex items-center justify-between">
                                                <span>{reason}</span>
                                                <span className="text-white">{count}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-slate-400">Wybierz dataset, aby zobaczyć dane treningowe.</p>
                    )}
                </div>
            </div>

            <div className="glass rounded-2xl p-4 space-y-4">
                <h2 className="text-lg font-semibold text-white">Generacja TTS</h2>

                <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                            type="checkbox"
                            checked={ttsSourceMode === 'target_dataset'}
                            onChange={(event) => setTtsSourceMode(event.target.checked ? 'target_dataset' : 'all_streamer')}
                        />
                        Use particular dataset
                    </label>
                    {ttsSourceMode === 'target_dataset' ? (
                        <>
                            <p className="text-xs text-slate-400">Particular mode uses only the selected dataset/run.</p>
                            <div>
                                <label className="text-xs uppercase tracking-wide text-slate-400">Dataset / Run</label>
                                <select
                                    value={selectedDatasetId}
                                    onChange={(event) => setSelectedDatasetId(event.target.value)}
                                    disabled={!selectedStreamer || selectedStreamerDatasets.length === 0}
                                    className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
                                >
                                    <option value="">Wybierz dataset</option>
                                    {selectedStreamerDatasets.map((dataset) => (
                                        <option key={dataset.datasetId} value={dataset.datasetId}>
                                            {dataset.runId ?? 'legacy'} | clips: {dataset.clipsCount} | {formatDate(dataset.createdAt)}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </>
                    ) : (
                        <p className="text-xs text-slate-400">
                            Default mode uses all available artifacts for this streamer.
                        </p>
                    )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    {!advancedMode && (
                        <div>
                            <label className="text-xs uppercase tracking-wide text-slate-400">Quality preset</label>
                            <select
                                value={ttsQualityPreset}
                                onChange={(event) => setTtsQualityPreset(event.target.value as 'fast' | 'balanced' | 'best')}
                                className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                            >
                                <option value="fast">Fast</option>
                                <option value="balanced">Balanced</option>
                                <option value="best">Best</option>
                            </select>
                            <p className="mt-1 text-xs text-slate-500">Beginner preset mode.</p>
                        </div>
                    )}
                    <label className={`flex items-center gap-2 text-sm text-slate-300 ${advancedMode ? 'pt-1' : 'pt-6'}`}>
                        <input
                            type="checkbox"
                            checked={ttsAcceptedOnly}
                            onChange={(event) => setTtsAcceptedOnly(event.target.checked)}
                        />
                        Use accepted-only clips if available
                    </label>
                </div>

                <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm text-slate-300">
                            <input
                                type="checkbox"
                                checked={advancedMode}
                                onChange={(event) => setAdvancedMode(event.target.checked)}
                            />
                            Advanced mode
                        </label>
                        {advancedMode && (
                            <button
                                type="button"
                                onClick={resetAdvancedDefaults}
                                className="text-xs px-2 py-1 rounded border border-white/20 text-slate-200 hover:bg-white/10"
                            >
                                Reset defaults
                            </button>
                        )}
                    </div>
                    {advancedMode ? (
                        <div className="space-y-3">
                            <p className="text-xs text-slate-400">
                                Advanced controls override preset behavior. Hover each label for ranges and guidance.
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-slate-400">Presets:</span>
                                <button
                                    type="button"
                                    onClick={() => applyAdvancedPreset('SAFE')}
                                    className="text-xs px-2 py-1 rounded border border-white/20 text-slate-100 hover:bg-white/10"
                                >
                                    SAFE
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyAdvancedPreset('QUALITY')}
                                    className="text-xs px-2 py-1 rounded border border-white/20 text-slate-100 hover:bg-white/10"
                                >
                                    QUALITY
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyAdvancedPreset('SPEED')}
                                    className="text-xs px-2 py-1 rounded border border-white/20 text-slate-100 hover:bg-white/10"
                                >
                                    SPEED
                                </button>
                            </div>
                            <div className="grid gap-2 md:grid-cols-3">
                                <label className="text-xs text-slate-300" title="Total target duration of selected reference audio, range 10-600s.">
                                    Target seconds
                                    <input type="range" min={10} max={300} step={10} value={advancedTargetSeconds} onChange={(event) => setAdvancedTargetSeconds(event.target.value)} className="w-full" />
                                    <input type="number" min={10} max={600} step={10} value={advancedTargetSeconds} onChange={(event) => setAdvancedTargetSeconds(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                                <label className="text-xs text-slate-300" title="Max clips taken per run bucket, range 1-64.">
                                    Max per run
                                    <input type="number" min={1} max={64} step={1} value={advancedMaxPerRun} onChange={(event) => setAdvancedMaxPerRun(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                                <label className="text-xs text-slate-300" title="Speaker similarity threshold, range 0.0-1.0.">
                                    Min speaker sim
                                    <input type="range" min={0} max={1} step={0.05} value={advancedMinSpeakerSim} onChange={(event) => setAdvancedMinSpeakerSim(event.target.value)} className="w-full" />
                                    <input type="number" min={0} max={1} step={0.05} value={advancedMinSpeakerSim} onChange={(event) => setAdvancedMinSpeakerSim(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>

                                <label className="text-xs text-slate-300" title="Drop too short clips, range 0-30s.">
                                    Min clip sec
                                    <input type="number" min={0} max={30} step={0.5} value={advancedMinClipSec} onChange={(event) => setAdvancedMinClipSec(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                                <label className="text-xs text-slate-300" title="Drop too long clips, range 0-60s.">
                                    Max clip sec
                                    <input type="number" min={0} max={60} step={0.5} value={advancedMaxClipSec} onChange={(event) => setAdvancedMaxClipSec(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                                <label className="text-xs text-slate-300" title="Hard cap on selected references, range 1-2000.">
                                    Max clips
                                    <input type="number" min={1} max={2000} step={1} value={advancedMaxClips} onChange={(event) => setAdvancedMaxClips(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>

                                <label className="text-xs text-slate-300" title="Final number of reference speaker wavs passed to model, range 1-128.">
                                    Speaker clip count
                                    <input type="number" min={1} max={128} step={1} value={advancedSpeakerClipCount} onChange={(event) => setAdvancedSpeakerClipCount(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                                <label className="text-xs text-slate-300" title="Current script supports XTTS model family.">
                                    Model
                                    <select value={advancedModel} onChange={(event) => setAdvancedModel(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100">
                                        <option value="xtts_v2">xtts_v2</option>
                                        <option value="xtts">xtts (alias)</option>
                                    </select>
                                </label>
                                <label className="text-xs text-slate-300" title="Language code supported by model, e.g. en, pl, de.">
                                    Language
                                    <input value={advancedLanguage} onChange={(event) => setAdvancedLanguage(event.target.value)} placeholder="en" className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>

                                <label className="text-xs text-slate-300" title="auto prefers CUDA if available. Use cuda to force GPU.">
                                    Device
                                    <select value={advancedDevice} onChange={(event) => setAdvancedDevice(event.target.value as 'auto' | 'cpu' | 'cuda')} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100">
                                        <option value="auto">auto</option>
                                        <option value="cuda">cuda</option>
                                        <option value="cpu">cpu</option>
                                    </select>
                                </label>
                                <label className="text-xs text-slate-300" title="Torch CPU threads. 12600K recommended 12-16.">
                                    CPU threads
                                    <input type="number" min={1} max={64} step={1} value={advancedCpuThreads} onChange={(event) => setAdvancedCpuThreads(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                                <label className="flex items-center gap-2 text-xs text-slate-300 pt-5" title="Enable cuDNN benchmark for stable input shapes on GPU.">
                                    <input type="checkbox" checked={advancedCudaBenchmark} onChange={(event) => setAdvancedCudaBenchmark(event.target.checked)} />
                                    CUDA benchmark
                                </label>

                                <label className="text-xs text-slate-300" title="Higher = more diverse, lower = more stable. Range 0-2.">
                                    Temperature
                                    <input type="range" min={0} max={2} step={0.05} value={advancedTemperature} onChange={(event) => setAdvancedTemperature(event.target.value)} className="w-full" />
                                    <input type="number" min={0} max={2} step={0.05} value={advancedTemperature} onChange={(event) => setAdvancedTemperature(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                                <label className="text-xs text-slate-300" title="Nucleus sampling. Lower = safer speech. Range 0-1.">
                                    Top-P
                                    <input type="range" min={0} max={1} step={0.05} value={advancedTopP} onChange={(event) => setAdvancedTopP(event.target.value)} className="w-full" />
                                    <input type="number" min={0} max={1} step={0.05} value={advancedTopP} onChange={(event) => setAdvancedTopP(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                                <label className="text-xs text-slate-300" title="Token shortlist size. 0 disables cap.">
                                    Top-K
                                    <input type="number" min={0} max={200} step={1} value={advancedTopK} onChange={(event) => setAdvancedTopK(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>

                                <label className="text-xs text-slate-300" title="Speech rate multiplier. 1.0 is neutral. Range 0.5-2.0.">
                                    Speed
                                    <input type="range" min={0.5} max={2} step={0.05} value={advancedSpeed} onChange={(event) => setAdvancedSpeed(event.target.value)} className="w-full" />
                                    <input type="number" min={0.5} max={2} step={0.05} value={advancedSpeed} onChange={(event) => setAdvancedSpeed(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                                <label className="text-xs text-slate-300" title="Penalty for repeated tokens. Range 0.5-3.0.">
                                    Repetition penalty
                                    <input type="number" min={0.5} max={3} step={0.1} value={advancedRepetitionPenalty} onChange={(event) => setAdvancedRepetitionPenalty(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                                <label className="text-xs text-slate-300" title="Length bias in decoder. Range 0.2-3.0.">
                                    Length penalty
                                    <input type="number" min={0.2} max={3} step={0.1} value={advancedLengthPenalty} onChange={(event) => setAdvancedLengthPenalty(event.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-100" />
                                </label>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400">Use presets only (fast/balanced/best).</p>
                    )}
                </div>
                <textarea
                    value={ttsText}
                    onChange={(event) => setTtsText(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-slate-100"
                    placeholder="Wpisz tekst do wygenerowania..."
                />

                {ttsSourceMode === 'target_dataset' && !selectedTargetDataset?.vodUrl && selectedTargetDataset && (
                    <p className="text-xs text-amber-300">
                        Ten dataset nie ma `vodUrl` (zwykle rekord legacy), więc nie da się uruchomić TTS dla tego wpisu.
                    </p>
                )}

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => void handleGenerate()}
                        disabled={!canGenerate}
                        className="primary-btn px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? 'Generating...' : 'Generate TTS'}
                    </button>
                    {generationError && <span className="text-sm text-red-300">{generationError}</span>}
                </div>

                {(isGenerating || generationProgress !== null) && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>Postęp generacji</span>
                            <span className="flex items-center gap-2">
                                <span>{generationProgress ?? 0}%</span>
                                {etaLabel && <span className="text-slate-400">ETA {etaLabel}</span>}
                            </span>
                        </div>
                        <div className="progress-track">
                            <div
                                className={`progress-bar ${isGenerating ? 'running' : outputPath ? 'done' : ''}`}
                                style={{ width: `${Math.max(0, Math.min(100, generationProgress ?? 0))}%` }}
                            />
                        </div>
                    </div>
                )}

                {outputPath && (
                    <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                        Wygenerowano plik:{' '}
                        <a
                            className="text-emerald-200 underline"
                            href={artifactUrl(outputPath)}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {outputPath}
                        </a>
                    </div>
                )}

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Logi</p>
                    <div className="max-h-40 overflow-auto text-xs text-slate-300 space-y-1 font-mono">
                        {generationLog.length === 0 ? (
                            <p className="text-slate-500">Brak logów.</p>
                        ) : (
                            generationLog.map((line, index) => <p key={`${line}-${index}`}>{line}</p>)
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
