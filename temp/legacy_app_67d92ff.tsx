// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react';
import WaveformBars from './shared/media/WaveformBars';
import Sidebar from './components/Sidebar';
import MiniStepper from './components/MiniStepper';
import StatusCard from './components/StatusCard';
import PresetBar from './components/PresetBar';
import DiffBanner from './components/DiffBanner';
import AudioPreviewCard from './components/AudioPreviewCard';
import ConsolePanel from './components/ConsolePanel';
import FooterNav from './components/FooterNav';
import EmptyState from './components/EmptyState';
import PathRow from './components/PathRow';
import SettingsRow from './components/SettingsRow';
import Toast from './components/Toast';
import SegmentReview from './components/SegmentReview';
import VoiceLab from './components/VoiceLab';
import PresetModal from './components/PresetModal';
import JobList from './components/JobList';
import PlatformBadge from './components/PlatformBadge';
import VodMetadataCard from './components/VodMetadataCard';
import VodMetadataCardSkeleton from './components/VodMetadataCardSkeleton';
import AudioExtractSection from './components/AudioExtractSection';
import TinderReview from './components/TinderReview';
import { StepId, StepState } from './state/types';
import { VodMeta, Job, createApi } from './api/client';

const shellClasses = 'rounded-xl border border-slate-800 bg-slate-950/70 shadow';

const initialSteps: StepState[] = [
    { id: 'vod', title: 'VOD', subtitle: 'Select VOD & Extract Audio', status: 'ready', ready: true, locked: false },
    { id: 'sanitize', title: 'Sanitize', subtitle: 'Trim and detect speech', status: 'idle', ready: false, locked: true },
    { id: 'review', title: 'Review', subtitle: 'Vote on segments', status: 'idle', ready: false, locked: true },
    { id: 'srt', title: 'SRT', subtitle: 'Generate subtitles', status: 'idle', ready: false, locked: true },
    { id: 'train', title: 'Train', subtitle: 'Build voice', status: 'idle', ready: false, locked: true },
    { id: 'tts', title: 'TTS', subtitle: 'Generate voice', status: 'idle', ready: false, locked: true },
];

function lockChain(steps: StepState[]): StepState[] {
    let unlock = true;
    const mapped = steps.map((s) => {
        const locked = !unlock;
        unlock = unlock && s.ready;
        return { ...s, locked, status: s.status as StepStatus };
    });
    return mapped as StepState[];
}

export default function App(): JSX.Element {
    const api = useMemo(() => createApi(), []);

    const [steps, setSteps] = useState<any[]>(() => lockChain(initialSteps));
    const [activeId, setActiveId] = useState<StepId>('vod');
    const [logs, setLogs] = useState<string[]>(['[i] Ready']);
    const [consoleCollapsed, setConsoleCollapsed] = useState(false);
    const [followLogs, setFollowLogs] = useState(true);
    const [sanitizePreset, setSanitizePreset] = useState<'Balanced' | 'Strict' | 'Lenient'>('Balanced');
    const [sanitizeMode, setSanitizeMode] = useState<'auto' | 'voice'>('auto');
    const [sanitizeAuto, setSanitizeAuto] = useState(true);
    const [sanitizeExtractVocals, setSanitizeExtractVocals] = useState(false);
    const [sanitizeUvrModel, setSanitizeUvrModel] = useState<'bs-roformer' | 'mdx-net' | 'demucs'>('bs-roformer');
    const [sanitizeUvrPrecision, setSanitizeUvrPrecision] = useState<'fp32' | 'fp16' | 'int8'>('fp16');
    const [sanitizeStrictness, setSanitizeStrictness] = useState(0.5);
    const [sanitizePreviewStart, setSanitizePreviewStart] = useState(0);
    const [sanitizePreviewDuration, setSanitizePreviewDuration] = useState(90);
    const [sanitizePreservePauses, setSanitizePreservePauses] = useState(true);
    const [sanitizeReduceSfx, setSanitizeReduceSfx] = useState(true);
    const [sanitizeStage, setSanitizeStage] = useState<string>('idle');
    const [sanitizeUvrProgress, setSanitizeUvrProgress] = useState<number | null>(null);
    const [sanitizeSegmentProgress, setSanitizeSegmentProgress] = useState<number | null>(null);
    const [sanitizePreviewProgress, setSanitizePreviewProgress] = useState<number | null>(null);
    const [sanitizeTargetLufs, setSanitizeTargetLufs] = useState(-18);
    const [sanitizeTruePeakDb, setSanitizeTruePeakDb] = useState(-1);
    const [vodUrl, setVodUrl] = useState('');
    const [vodMeta, setVodMeta] = useState<VodMeta | null>(null);
    const [vodError, setVodError] = useState<string | null>(null);
    const [vodLoading, setVodLoading] = useState(false);
    const [ttsText, setTtsText] = useState('Sample line for TTS.');
    const [ttsStreamer, setTtsStreamer] = useState('juggernautjason');
    const [srtExcerpt, setSrtExcerpt] = useState<string | null>(null);
    const [sanitizePreviewPath, setSanitizePreviewPath] = useState<string | null>(null);
    const [sanitizePreviewRate, setSanitizePreviewRate] = useState<number | null>(null);
    const [sanitizeCleanDuration, setSanitizeCleanDuration] = useState<number | null>(null);
    const [voiceSamples, setVoiceSamples] = useState<any[]>([]);
    const [voiceSelections, setVoiceSelections] = useState<string[]>([]);
    const [manualSamples, setManualSamples] = useState<Array<{ start: number; end: number; id: string }>>([]);
    const [selectionStart, setSelectionStart] = useState<number>(0);
    const [selectionEnd, setSelectionEnd] = useState<number>(5);
    const [voiceSampleMinDuration, setVoiceSampleMinDuration] = useState<number>(2.0);
    const [voiceSampleMaxDuration, setVoiceSampleMaxDuration] = useState<number>(6.0);
    const [voiceSampleMinRmsDb, setVoiceSampleMinRmsDb] = useState<number>(-35);
    const [voiceSampleMaxCount, setVoiceSampleMaxCount] = useState<number>(8);
    const [sanitizeSegments, setSanitizeSegments] = useState<any[]>([]);
    const [sanitizePreviewRows, setSanitizePreviewRows] = useState<any[]>([]);
    const [sanitizeInsights, setSanitizeInsights] = useState<any | null>(null);
    const [appliedSanitize, setAppliedSanitize] = useState<any | null>(null);
    const [sanitizeCleanPath, setSanitizeCleanPath] = useState<string | null>(null);
    const [rawAudioPath, setRawAudioPath] = useState<string | null>(null);
    const [segmentAudioPath, setSegmentAudioPath] = useState<string | null>(null);
    const [exportClipsPath, setExportClipsPath] = useState<string | null>(null);
    const [showSegmentReview, setShowSegmentReview] = useState(false);
    const [silenceThresholdDb, setSilenceThresholdDb] = useState(-35);
    const [minSegmentMs, setMinSegmentMs] = useState(800);
    const [mergeGapMs, setMergeGapMs] = useState(300);
    const [targetPeakDb, setTargetPeakDb] = useState(-1);
    const [fadeMs, setFadeMs] = useState(12);
    const [vodQuality, setVodQuality] = useState<string>('best');
    const [twitchAuthToken, setTwitchAuthToken] = useState<string>('');
    const [jobs, setJobs] = useState<Job[]>([]);
    const [showJobList, setShowJobList] = useState(false);
    const [helperLine, setHelperLine] = useState('');
    const [customPresets, setCustomPresets] = useState<string[]>([]);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [presetModalMode, setPresetModalMode] = useState<'save' | 'saveAs' | 'manage'>('save');
    const [toast, setToast] = useState<string | null>(null);
    const [reviewAcceptedIdxs, setReviewAcceptedIdxs] = useState<number[]>([]);
    const [reviewAcceptedDuration, setReviewAcceptedDuration] = useState<number>(0);

    // Phase A: Audio extraction state (now part of VOD screen)
    const [audioStatus, setAudioStatus] = useState<'idle' | 'extracting' | 'done'>('idle');

    // Phase B: Tinder Review state
    const [showTinderReview, setShowTinderReview] = useState(false);
    const [reviewVotes, setReviewVotes] = useState<Record<number, 'accept' | 'reject'>>({});

    // Platform detection from URL (instant feedback)
    const [detectedPlatform, setDetectedPlatform] = useState<'twitch' | 'youtube' | null>(null);
    const [platformDetecting, setPlatformDetecting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.getJobs();
                if (cancelled) return;
                const sorted = [...res].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                setJobs(sorted);
                if (sorted.length > 0) {
                    setShowJobList(true);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to load jobs';
                appendLog(`[job] ${msg}`);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [api]);

    // Detect platform with regex and auto-trigger validation
    useEffect(() => {
        const url = vodUrl.trim();

        if (!url) {
            setDetectedPlatform(null);
            setPlatformDetecting(false);
            return;
        }

        // Regex patterns for Twitch and YouTube URLs
        const twitchPattern = /^https?:\/\/(www\.)?twitch\.tv\/videos\/\d+/i;
        const youtubePattern = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

        let platform: 'twitch' | 'youtube' | null = null;

        if (twitchPattern.test(url)) {
            platform = 'twitch';
        } else if (youtubePattern.test(url)) {
            platform = 'youtube';
        }

        if (platform && !vodMeta) {
            setDetectedPlatform(platform);
            setPlatformDetecting(true);

            // Auto-trigger validation after a brief delay
            const timer = setTimeout(() => {
                if (!vodLoading && !vodMeta) {
                    checkVod();
                }
            }, 800);

            return () => clearTimeout(timer);
        } else {
            setDetectedPlatform(null);
            setPlatformDetecting(false);
        }
    }, [vodUrl, vodMeta, vodLoading]);

    const manualSamplesDuration = useMemo(() => manualSamples.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0), [manualSamples]);
    const selectedVoiceSamples = useMemo(() => voiceSamples.filter((v) => voiceSelections.includes(v.path)), [voiceSamples, voiceSelections]);
    const activeStep = steps.find((s) => s.id === activeId) || steps[0];
    const stepIndex = steps.findIndex((s) => s.id === activeId);
    const canPrev = stepIndex > 0;
    const canNext = stepIndex < steps.length - 1 && !steps[stepIndex + 1]?.locked;

    const formatNumber = (value: number | null | undefined, digits = 2) => (value !== null && value !== undefined && Number.isFinite(value) ? value.toFixed(digits) : 'ΓÇö');
    const formatHms = (seconds: number) => {
        if (!Number.isFinite(seconds)) return '0:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const pad = (v: number) => v.toString().padStart(2, '0');
        return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
    };

    const appendLog = (line: string) => setLogs((prev) => [...prev, line]);
    const appendLogs = (scope: string, lines: string[]) => setLogs((prev) => [...prev, ...lines.map((l) => (scope ? `[${scope}] ${l}` : l))]);
    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2500);
    };

    const markRunning = (id: StepId, message?: string) => {
        setSteps((prev) =>
            prev.map((s): StepState =>
                s.id === id
                    ? { ...s, status: 'running', message: message || s.message, locked: false }
                    : s
            )
        );
    };

    const markDone = (id: StepId, outputs?: { label: string; path: string }[], message?: string) => {
        setSteps((prev) => lockChain(prev.map((s): StepState => (s.id === id ? { ...s, status: 'done', ready: true, locked: false, message, outputs } : s))));
    };

    const markError = (id: StepId, message?: string) => {
        setSteps((prev) => prev.map((s): StepState => (s.id === id ? { ...s, status: 'error', message } : s)));
        setActiveId(id);
    };

    const savePreset = (name: string) => {
        setCustomPresets((prev) => Array.from(new Set([...prev, name])));
        showToast(`Preset saved: ${name}`);
    };
    const deletePreset = (name: string) => setCustomPresets((prev) => prev.filter((p) => p !== name));
    const loadPreset = (name: string) => {
        setSanitizePreset(name as 'Balanced' | 'Strict' | 'Lenient');
        if (name === 'Strict') {
            setSanitizeStrictness(0.8);
        } else if (name === 'Lenient') {
            setSanitizeStrictness(0.3);
        } else {
            setSanitizeStrictness(0.5);
        }
    };

    const saveSegmentReview = () => {
        setShowSegmentReview(false);
        showToast('Segment review saved');
    };

    const exportClips = () => {
        if (!sanitizeSegments || sanitizeSegments.length === 0) {
            showToast('No segments to export');
            return;
        }
        const placeholderPath = 'clips/output';
        setExportClipsPath(placeholderPath);
        showToast('Exported clips');
    };

    const checkVod = async () => {
        if (!vodUrl.trim()) {
            setVodError('Enter a VOD URL first.');
            return;
        }
        setVodError(null);
        setVodLoading(true);
        markRunning('vod', 'Checking VODΓÇª');
        try {
            const meta = await api.checkVod(vodUrl.trim());
            setVodMeta(meta);
            setPlatformDetecting(false);
            setSteps((prev) =>
                lockChain(
                    prev.map((s): StepState => {
                        if (s.id === 'vod') return { ...s, status: 'done', ready: true, locked: false, message: 'VOD validated' };
                        return s;
                    })
                )
            );
            appendLog(`[vod] checked: ${meta.title || 'ok'}`);
            // Don't auto-navigate, stay on VOD to show audio section
        } catch (err) {
            const message = err instanceof Error ? err.message : 'VOD check failed';
            setVodError(message);
            markError('vod', message);
            setPlatformDetecting(false);
        } finally {
            setVodLoading(false);
        }
    };

    const handleSelectJob = (job: Job, startStep?: StepId) => {
        appendLog(`[job] Loading job: ${job.title}`);
        // Restore job state
        setVodUrl(job.vodUrl);
        setVodMeta({
            streamer: job.streamer,
            title: job.title,
            duration: '',
            previewUrl: '',
            vodId: job.vodUrl.match(/\d+/)?.[0] || '',
            platform: job.vodUrl.includes('youtube') ? 'youtube' : 'twitch', // Detect platform from URL
        });

        // Backward compatibility: if old job has audio step completed or audioPath exists, mark audio as done
        const hasAudio = job.steps.audio || (job.outputs?.audioPath != null);
        if (hasAudio) {
            setAudioStatus('done');
        }

        // Unlock completed steps
        const stepOrder: StepId[] = ['vod', 'sanitize', 'review', 'srt', 'train', 'tts'];
        setSteps((prev) => {
            const updated = prev.map((s): StepState => {
                const stepKey = s.id as keyof Job['steps'];
                const isCompleted = job.steps[stepKey];
                // If user wants to rework from a given step, keep earlier steps as-is, reset from that point onward
                const isAfterStart = startStep ? stepOrder.indexOf(s.id as StepId) >= stepOrder.indexOf(startStep) : false;
                const status = startStep && isAfterStart ? 'idle' : isCompleted ? 'done' : 'idle';
                const ready = startStep && isAfterStart ? false : !!isCompleted;
                return {
                    ...s,
                    status,
                    ready,
                    locked: false,
                };
            });
            return lockChain(updated);
        });

        // Set active step to requested start or first incomplete
        const firstIncomplete = (['vod', 'sanitize', 'review', 'srt', 'train', 'tts'] as StepId[]).find(
            (stepId) => !job.steps[stepId as keyof Job['steps']]
        );
        const targetStep = startStep || firstIncomplete || 'tts';
        setActiveId(targetStep as StepId);

        // Restore known output paths for playback
        if (job.outputs) {
            setRawAudioPath(job.outputs.audioPath || null);
            setSanitizeCleanPath(job.outputs.sanitizePath || null);
            setSegmentAudioPath(job.outputs.sanitizePath || job.outputs.audioPath || segmentAudioPath);
        }

        // Hide job list and show VOD form
        setShowJobList(false);
        appendLog(`[job] Resumed at step: ${firstIncomplete || 'complete'}`);
        showToast(`Job loaded: ${job.title}`);
    };

    const handleDeleteJob = async (jobId: string) => {
        try {
            await api.deleteJob(jobId);
            setJobs((prev) => prev.filter((j) => j.id !== jobId));
            appendLog(`[job] Deleted job: ${jobId}`);
            showToast('Job deleted');
        } catch (err) {
            appendLog('[job] Failed to delete job');
            showToast('Failed to delete job');
        }
    };

    const runAudio = async () => {
        if (!vodMeta) {
            setVodError('Run VOD check first.');
            return;
        }
        setAudioStatus('extracting');
        try {
            const res = await api.runAudio({
                vodUrl: vodUrl.trim(),
                force: false,
                useDemucs: false,
                skipAac: false,
                authToken: twitchAuthToken.trim() || undefined,
                vodQuality,
            });
            setRawAudioPath(res.path);
            setAudioStatus('done');
            // Directly unlock Sanitize step after audio completes
            setSteps((prev) =>
                lockChain(
                    prev.map((s): StepState => {
                        if (s.id === 'sanitize') return { ...s, ready: true };
                        return s;
                    })
                )
            );
            appendLog(`[vod/audio] extracted: ${res.path}`);
            showToast('Audio extracted successfully');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Audio failed';
            setAudioStatus('idle');
            setVodError(message);
            appendLog(`[vod/audio] error: ${message}`);
            showToast('Audio extraction failed');
        }
    };

    const runSanitize = async (options?: { previewOnly?: boolean }) => {
        if (!vodMeta) {
            setVodError('Run VOD check first.');
            setActiveId('vod');
            return;
        }
        const previewOnly = options?.previewOnly ?? false;
        markRunning('sanitize', previewOnly ? 'Generating previewΓÇª' : 'Running sanitizeΓÇª');
        setSanitizeStage(sanitizeExtractVocals ? 'uvr' : 'segment');
        setSanitizeUvrProgress(sanitizeExtractVocals ? 0 : 100);
        setSanitizeSegmentProgress(0);
        setSanitizePreviewProgress(0);
        try {
            const presetKey: 'strict' | 'balanced' | 'lenient' = sanitizePreset === 'Strict' ? 'strict' : sanitizePreset === 'Lenient' ? 'lenient' : 'balanced';
            const res = await api.runSanitize({
                vodUrl: vodUrl.trim(),
                mode: sanitizeMode,
                preset: presetKey,
                strictness: sanitizeStrictness,
                extractVocals: sanitizeExtractVocals,
                uvrModel: sanitizeUvrModel,
                uvrPrecision: sanitizeUvrPrecision,
                preview: previewOnly,
                previewStart: sanitizePreviewStart,
                previewDuration: sanitizePreviewDuration,
                voiceSample: sanitizeMode === 'voice',
                voiceSampleCount: sanitizeMode === 'voice' ? voiceSampleMaxCount : 0,
                voiceSampleMinDuration,
                voiceSampleMaxDuration,
                voiceSampleMinRmsDb,
                manualSamples: manualSamples.length > 0 ? manualSamples.map((s) => ({ start: s.start, end: s.end })) : undefined,
                preservePauses: sanitizePreservePauses,
                reduceSfx: sanitizeReduceSfx,
                targetLufs: sanitizeTargetLufs,
                truePeakLimitDb: sanitizeTruePeakDb,
                fadeMs,
                stream: true,
                onLog: (line: string) => appendLogs('sanitize', [line]),
                onProgress: (evt) => {
                    if (!evt) return;
                    if (evt.stage) {
                        setSanitizeStage(evt.stage);
                    }
                    if (evt.stage === 'uvr') {
                        setSanitizeUvrProgress((prev) => (typeof evt.value === 'number' ? evt.value : prev ?? 0));
                    }
                    if (evt.stage === 'segment') {
                        setSanitizeSegmentProgress((prev) => (typeof evt.value === 'number' ? evt.value : prev ?? 5));
                    }
                    if (evt.stage === 'preview') {
                        setSanitizePreviewProgress((prev) => (typeof evt.value === 'number' ? evt.value : prev ?? 5));
                    }
                },
            });
            if (res.log && Array.isArray(res.log)) {
                appendLogs('sanitize', res.log);
            }
            const appliedParams = (res.appliedSettings && (res.appliedSettings as any).params) || {};
            setAppliedSanitize(appliedParams);
            if (typeof appliedParams.silenceThresholdDb === 'number') setSilenceThresholdDb(appliedParams.silenceThresholdDb);
            if (typeof appliedParams.minSegmentMs === 'number') setMinSegmentMs(appliedParams.minSegmentMs);
            if (typeof appliedParams.mergeGapMs === 'number') setMergeGapMs(appliedParams.mergeGapMs);
            if (typeof appliedParams.targetPeakDb === 'number') setTargetPeakDb(appliedParams.targetPeakDb);
            if (typeof appliedParams.fadeMs === 'number') setFadeMs(appliedParams.fadeMs);
            setSanitizePreviewPath(res.previewPath);
            setSanitizeCleanPath(res.cleanPath ?? null);
            setSegmentAudioPath(res.cleanPath ?? res.previewPath ?? rawAudioPath);
            setSanitizePreviewRate(res.previewSampleRate);
            setSanitizeCleanDuration(res.cleanDuration ?? null);
            setSanitizeSegments(res.previewSegments || []);
            setVoiceSamples(res.voiceSamples || []);
            setVoiceSelections((res.voiceSamples || []).map((v: any) => v.path));
            const outputs = [
                res.cleanPath ? { label: 'Clean audio', path: res.cleanPath } : null,
                res.segmentsPath ? { label: 'Segments JSON', path: res.segmentsPath } : null,
            ].filter(Boolean) as { label: string; path: string }[];
            setSanitizeStage('done');
            setSanitizeSegmentProgress(100);
            setSanitizePreviewProgress(100);
            if (sanitizeExtractVocals) setSanitizeUvrProgress((prev) => prev ?? 100);
            if (previewOnly) {
                setSteps((prev) => {
                    const next = prev.map((s): StepState =>
                        s.id === 'sanitize'
                            ? {
                                ...s,
                                status: 'preview',
                                ready: false,
                                locked: false,
                                message: 'Preview ready ΓÇö run full sanitize to finalize',
                                outputs,
                            }
                            : s
                    );
                    return lockChain(next) as StepState[];
                });
                appendLog('[done] sanitize preview ready');
            } else {
                markDone('sanitize', outputs, `Segments: ${res.segments}`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Sanitize failed';
            appendLogs('sanitize', [message]);
            setSanitizeStage('error');
            markError('sanitize', message);
        }
    };

    const runSrt = async () => {
        if (!vodMeta) {
            setVodError('Run VOD check first.');
            setActiveId('vod');
            return;
        }
        markRunning('srt');
        try {
            const res = await api.runSrt({ vodUrl: vodUrl.trim() });
            appendLogs('srt', res.log);
            setSrtExcerpt(res.excerpt);
            const outputs = [{ label: 'SRT file', path: res.path }];
            appendLog(`[srt] generated ${res.lines} lines`);
            if (res.excerpt) appendLog(`[srt] excerpt: ${res.excerpt.slice(0, 160)}${res.excerpt.length > 160 ? 'ΓÇª' : ''}`);
            markDone('srt', outputs, `Lines: ${res.lines}`);
        } catch (err) {
            const raw = err instanceof Error ? err.message : 'SRT failed';
            const friendly = raw.toLowerCase().includes('22') || raw.toLowerCase().includes('invalid argument')
                ? 'SRT failed: invalid argument (check audio path/whisper/ffmpeg args; see backend logs for stack trace).'
                : raw;
            markError('srt', friendly);
            appendLog(`[srt] error: ${raw}`);
        }
    };

    const runTts = async () => {
        if (!vodMeta) {
            setVodError('Run VOD check first.');
            setActiveId('vod');
            return;
        }
        if (!ttsText.trim()) {
            appendLog('[tts] enter text first');
            return;
        }
        const streamer = ttsStreamer.trim() || vodMeta.streamer || 'streamer';
        markRunning('tts', 'Generating TTSΓÇª');
        appendLog(`[tts] starting for streamer=${streamer}`);
        try {
            const res = await api.runTts({
                vodUrl: vodUrl.trim(),
                text: ttsText.trim(),
                streamer,
                onLog: (line) => appendLogs('tts', [line]),
                // Prefer selected voice samples when available (backend will pick voice_samples automatically)
            });
            appendLogs('tts', res.log);
            const outputs = [{ label: 'TTS audio', path: res.outputPath }];
            markDone('tts', outputs, 'TTS ready');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'TTS failed';
            markError('tts', message);
        }
    };

    const runTrain = async () => {
        if (!vodMeta) {
            setVodError('Run VOD check first.');
            setActiveId('vod');
            return;
        }
        const streamer = ttsStreamer.trim() || vodMeta.streamer || 'streamer';
        markRunning('train', 'Training voiceΓÇª');
        appendLog(`[train] starting for streamer=${streamer}`);
        const resolvedVodUrl = vodUrl.trim() || (vodMeta.vodId ? `https://www.twitch.tv/videos/${vodMeta.vodId}` : '');
        try {
            const res = await api.runTrain({ vodUrl: resolvedVodUrl });
            appendLogs('train', res.log);
            setTtsStreamer(streamer);
            const outputs = [
                { label: 'Dataset', path: res.datasetPath },
                { label: 'Clips dir', path: res.clipsDir },
                { label: 'Manifest', path: res.manifestPath },
                { label: 'Segments', path: res.segmentsPath },
            ];
            markDone('train', outputs, 'Voice dataset ready');
            setActiveId('tts');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Train failed';
            markError('train', message);
        }
    };

    const goPrev = () => {
        if (!canPrev) return;
        setActiveId(steps[stepIndex - 1].id);
    };

    const goNext = () => {
        if (!canNext) return;
        setActiveId(steps[stepIndex + 1].id);
    };

    const renderVod = () => {
        // Create a virtual audio step for the AudioExtractSection component
        const audioStepVirtual: StepState = {
            id: 'vod', // Use vod id since we merged the steps
            title: 'Audio',
            subtitle: 'Extract audio',
            status: audioStatus === 'extracting' ? 'running' : audioStatus === 'done' ? 'done' : 'idle',
            ready: audioStatus === 'done',
            locked: false,
            outputs: rawAudioPath ? [{ label: 'Audio path', path: rawAudioPath }] : [],
        };

        return (
            <div className="space-y-3">
                {/* Job List (show when available and showJobList=true) */}
                {jobs.length > 0 && showJobList && (
                    <div className={shellClasses + ' p-4 space-y-3'}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-lg font-semibold text-slate-100">Resume Job</p>
                                <p className="text-sm text-slate-400">Select an existing VOD job to continue.</p>
                            </div>
                            <button
                                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-100 font-semibold hover:border-accent hover:text-accent"
                                onClick={() => setShowJobList(false)}
                            >
                                Start new VOD
                            </button>
                        </div>
                        <JobList jobs={jobs} onSelectJob={handleSelectJob} onDeleteJob={handleDeleteJob} />
                    </div>
                )}

                {/* VOD Input Form (show when showJobList=false or no jobs) */}
                {(!showJobList || jobs.length === 0) && (
                    <>
                        {/* Section 1: URL Input & Validation */}
                        <div className={shellClasses + ' p-4 space-y-3'}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-lg font-semibold text-slate-100">VOD & Audio</p>
                                    <p className="text-sm text-slate-400">Validate VOD and extract audio track</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {jobs.length > 0 && !showJobList && (
                                        <button
                                            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-100 font-semibold hover:border-accent hover:text-accent"
                                            onClick={() => setShowJobList(true)}
                                        >
                                            Resume job
                                        </button>
                                    )}
                                    <button
                                        className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60 hover:bg-accent/90 transition"
                                        onClick={checkVod}
                                        disabled={vodLoading}
                                    >
                                        {vodLoading ? 'Validating...' : 'Validate VOD'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-slate-200 flex items-center justify-between">
                                    <span>VOD URL</span>
                                    {detectedPlatform && !vodMeta && (
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold animate-fadeIn
                                            bg-slate-800/60 text-slate-300 border border-slate-600/40">
                                            {platformDetecting && vodLoading ? (
                                                <>
                                                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    <span className="opacity-60">Detecting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    {detectedPlatform === 'twitch' ? (
                                                        <svg className="w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-3.5 h-3.5 opacity-60" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                                        </svg>
                                                    )}
                                                    <span className="opacity-60">{detectedPlatform === 'twitch' ? 'Twitch' : 'YouTube'}</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </label>
                                <input
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                                    placeholder="https://www.twitch.tv/videos/... or https://youtube.com/watch?v=..."
                                    value={vodUrl}
                                    onChange={(e) => setVodUrl(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && !vodLoading && checkVod()}
                                />
                                <p className="text-xs text-slate-400">
                                    Paste a Twitch or YouTube VOD URL. We'll detect the platform and fetch metadata.
                                </p>
                                {vodError && <p className="text-xs text-rose-300">{vodError}</p>}
                            </div>

                            {/* Auth token - only show for Twitch or when not sure */}
                            {(!vodMeta || vodMeta.platform === 'twitch') && (
                                <div className="space-y-2">
                                    <label className="text-sm text-slate-200 flex items-center gap-2">
                                        Twitch auth_token (if protected)
                                        <span className="text-[11px] text-slate-400">stored locally</span>
                                    </label>
                                    <input
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                                        placeholder="auth_token cookie"
                                        type="password"
                                        value={twitchAuthToken}
                                        onChange={(e) => setTwitchAuthToken(e.target.value)}
                                    />
                                    <p className="text-[11px] text-slate-400">
                                        Optional: For subscriber-only VODs
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Section 2: Skeleton Loading (during validation) */}
                        {vodLoading && !vodMeta && detectedPlatform && (
                            <VodMetadataCardSkeleton />
                        )}

                        {/* Section 3: VOD Metadata Card (appears after validation) */}
                        {vodMeta && (
                            <VodMetadataCard meta={vodMeta} />
                        )}

                        {/* Section 4: Audio Extraction (appears after metadata) */}
                        {vodMeta && (
                            <AudioExtractSection
                                vodQuality={vodQuality}
                                onVodQualityChange={setVodQuality}
                                audioStep={audioStepVirtual}
                                onExtract={runAudio}
                                onRerun={runAudio}
                                onShowToast={showToast}
                                onViewLogs={() => setConsoleCollapsed(false)}
                            />
                        )}
                    </>
                )}
            </div>
        );
    };

    const renderSanitize = () => {
        const uvrPctRaw = sanitizeExtractVocals ? (sanitizeUvrProgress ?? 1) : 100;
        const segmentPctRaw = sanitizeSegmentProgress ?? 0;
        const previewPctRaw = sanitizePreviewProgress ?? 0;
        const weights = sanitizeExtractVocals ? { uvr: 0.6, segment: 0.3, preview: 0.1 } : { uvr: 0, segment: 0.7, preview: 0.3 };
        const overallPct = Math.max(2, Math.min(100, Math.round(weights.uvr * uvrPctRaw + weights.segment * segmentPctRaw + weights.preview * previewPctRaw)));
        const stageLabel =
            sanitizeStage === 'uvr'
                ? '≡ƒÄ╡ Extracting vocals'
                : sanitizeStage === 'segment'
                    ? 'Speech detection'
                    : sanitizeStage === 'preview'
                        ? 'Rendering preview'
                        : sanitizeStage === 'done'
                            ? 'Finishing'
                            : sanitizeStage === 'error'
                                ? 'Error'
                                : 'Processing';

        return (
            <div className="space-y-3">
                {/* Header */}
                <div className={shellClasses + ' p-4'}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <p className="text-lg font-semibold text-slate-100">Sanitize</p>
                            <p className="text-sm text-slate-400">Clean audio, detect speech, prepare training segments</p>
                        </div>
                        {activeStep.status === 'done' && (
                            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-sm font-medium">
                                Γ£ô Complete
                            </span>
                        )}
                    </div>
                </div>

                {/* Section 1: Mode Selection - ALWAYS VISIBLE FIRST */}
                {activeStep.status !== 'running' && (
                    <div className={shellClasses + ' p-4'}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-slate-200">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold mr-2">1</span>
                                Choose Mode
                            </p>
                            {sanitizeMode && (
                                <p className="text-xs text-slate-400 animate-fadeIn">{sanitizeMode === 'auto' ? 'AI-driven cleanup' : 'Manual control'}</p>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                onClick={() => setSanitizeMode('auto')}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${sanitizeMode === 'auto'
                                    ? 'border-accent bg-accent/5 shadow-lg shadow-accent/10'
                                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <span className="text-cyan-400 font-semibold">≡ƒñû Automatic Flow</span>
                                    {sanitizeMode === 'auto' && (
                                        <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-xs">Γ£ô Selected</span>
                                    )}
                                </div>
                                <p className="text-sm font-semibold text-slate-100 mb-1">AI-driven cleanup</p>
                                <p className="text-xs text-slate-400 leading-relaxed">Recommended for most users. Automatically detects speech, removes silence, and prepares clean segments.</p>
                            </button>

                            <button
                                onClick={() => setSanitizeMode('voice')}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${sanitizeMode === 'voice'
                                    ? 'border-amber-500 bg-amber-500/5 shadow-lg shadow-amber-500/10'
                                    : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <span className="text-amber-400 font-semibold">≡ƒÄ» Manual Flow</span>
                                    {sanitizeMode === 'voice' && (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">Γ£ô Selected</span>
                                    )}
                                </div>
                                <p className="text-sm font-semibold text-slate-100 mb-1">Full control</p>
                                <p className="text-xs text-slate-400 leading-relaxed">Advanced: Pick reference samples manually and fine-tune all parameters.</p>
                            </button>
                        </div>
                    </div>
                )}

                {/* Section 2: Cleanup Preset - shows after mode selection */}
                {activeStep.status !== 'running' && sanitizeMode && (
                    <div className={shellClasses + ' p-4 space-y-3 animate-fadeIn'} style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold text-slate-200">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold mr-2">2</span>
                                Cleanup Preset
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={sanitizePreset}
                                onChange={(e) => {
                                    const val = e.target.value as 'Balanced' | 'Strict' | 'Lenient';
                                    setSanitizePreset(val);
                                    loadPreset(val);
                                }}
                                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-sm hover:border-accent focus:border-accent focus:outline-none transition-colors"
                            >
                                <option value="Balanced">ΓÜû∩╕Å Balanced (recommended)</option>
                                <option value="Strict">≡ƒÄ» Strict (max cleanup)</option>
                                <option value="Lenient">≡ƒîè Lenient (preserve more)</option>
                            </select>
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-400">Strictness:</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={sanitizeStrictness * 100}
                                    onChange={(e) => setSanitizeStrictness(Number(e.target.value) / 100)}
                                    className="w-24"
                                />
                                <span className="text-xs text-slate-300 font-mono w-8">{Math.round(sanitizeStrictness * 100)}%</span>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400">
                            Controls how aggressively silence and noise are removed. Higher = cleaner but may cut off natural pauses.
                        </p>
                    </div>
                )}

                {/* Section 3: Vocal Isolation - shows after mode selection */}
                {activeStep.status !== 'running' && sanitizeMode && (
                    <div className={shellClasses + ' p-4 space-y-3 animate-fadeIn'} style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent/20 text-accent text-xs font-bold">3</span>
                                <p className="text-sm font-semibold text-slate-200">Vocal Isolation (UVR)</p>
                                <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-medium">OPTIONAL</span>
                            </div>
                            <p className="text-xs text-slate-400">Pre-processing step</p>
                        </div>
                        
                        {/* Enable toggle */}
                        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={sanitizeExtractVocals}
                                    onChange={(e) => setSanitizeExtractVocals(e.target.checked)}
                                    className="mt-0.5 w-4 h-4"
                                />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-slate-100 mb-1">Enable vocal separation</p>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Uses deep learning models to extract vocal tracks from mixed audio sources. Removes background music, game audio, and environmental noise before speech detection.
                                    </p>
                                </div>
                            </label>
                        </div>

                        {/* Configuration panel - shows when enabled */}
                        {sanitizeExtractVocals && (
                            <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-4 animate-fadeIn">
                                <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                                    <span className="text-xs font-semibold text-slate-300">UVR CONFIGURATION</span>
                                </div>

                                {/* Model Selection */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-300">Separation Model</label>
                                    <select
                                        value={sanitizeUvrModel}
                                        onChange={(e) => setSanitizeUvrModel(e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-sm hover:border-accent focus:border-accent focus:outline-none transition-colors"
                                    >
                                        <option value="bs-roformer">BS-Roformer (Best quality, ~3-5 min)</option>
                                        <option value="mdx-net">MDX-Net (Balanced, ~2-3 min)</option>
                                        <option value="demucs">Demucs v4 (Fastest, ~1-2 min)</option>
                                    </select>
                                    <p className="text-[11px] text-slate-500">
                                        {sanitizeUvrModel === 'bs-roformer' && 'State-of-the-art transformer model. Highest vocal quality, slowest processing.'}
                                        {sanitizeUvrModel === 'mdx-net' && 'Hybrid CNN model. Good balance between quality and speed.'}
                                        {sanitizeUvrModel === 'demucs' && 'Waveform-based U-Net. Fastest but may leave artifacts.'}
                                    </p>
                                </div>

                                {/* Precision Selection */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-slate-300">Inference Precision</label>
                                    <select
                                        value={sanitizeUvrPrecision}
                                        onChange={(e) => setSanitizeUvrPrecision(e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-sm hover:border-accent focus:border-accent focus:outline-none transition-colors"
                                    >
                                        <option value="fp32">FP32 (Full precision, best quality)</option>
                                        <option value="fp16">FP16 (Half precision, 2x faster, recommended)</option>
                                        <option value="int8">INT8 (Quantized, 4x faster, lower quality)</option>
                                    </select>
                                    <p className="text-[11px] text-slate-500">
                                        {sanitizeUvrPrecision === 'fp32' && 'Uses 32-bit floating point. Highest accuracy, requires more VRAM.'}
                                        {sanitizeUvrPrecision === 'fp16' && 'Uses 16-bit floating point. Nearly identical quality, 50% faster. Requires GPU support.'}
                                        {sanitizeUvrPrecision === 'int8' && '8-bit integer quantization. Significant speedup, may introduce artifacts.'}
                                    </p>
                                </div>

                                {/* Technical specs */}
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                                    <div className="rounded bg-slate-950/60 px-2 py-1.5">
                                        <p className="text-[10px] text-slate-500">Est. time (2h VOD)</p>
                                        <p className="text-xs text-slate-200 font-mono">
                                            {sanitizeUvrModel === 'bs-roformer' && sanitizeUvrPrecision === 'fp32' && '~5 min'}
                                            {sanitizeUvrModel === 'bs-roformer' && sanitizeUvrPrecision === 'fp16' && '~3 min'}
                                            {sanitizeUvrModel === 'bs-roformer' && sanitizeUvrPrecision === 'int8' && '~2 min'}
                                            {sanitizeUvrModel === 'mdx-net' && sanitizeUvrPrecision === 'fp32' && '~3 min'}
                                            {sanitizeUvrModel === 'mdx-net' && sanitizeUvrPrecision === 'fp16' && '~2 min'}
                                            {sanitizeUvrModel === 'mdx-net' && sanitizeUvrPrecision === 'int8' && '~1 min'}
                                            {sanitizeUvrModel === 'demucs' && sanitizeUvrPrecision === 'fp32' && '~2 min'}
                                            {sanitizeUvrModel === 'demucs' && sanitizeUvrPrecision === 'fp16' && '~1 min'}
                                            {sanitizeUvrModel === 'demucs' && sanitizeUvrPrecision === 'int8' && '~30 sec'}
                                        </p>
                                    </div>
                                    <div className="rounded bg-slate-950/60 px-2 py-1.5">
                                        <p className="text-[10px] text-slate-500">VRAM usage</p>
                                        <p className="text-xs text-slate-200 font-mono">
                                            {sanitizeUvrPrecision === 'fp32' && '~4-6 GB'}
                                            {sanitizeUvrPrecision === 'fp16' && '~2-3 GB'}
                                            {sanitizeUvrPrecision === 'int8' && '~1-2 GB'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Status & Progress Section */}
                <div className={shellClasses + ' p-4 space-y-3'}>
                    <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />
                    {activeStep.status === 'error' && (
                        <DiffBanner message={activeStep.message || 'Sanitize failed. Adjust settings and re-run.'} onRerun={runSanitize} />
                    )}

                    {/* Running State - Progress & Live Updates */}
                    {activeStep.status === 'running' && (
                        <div className="space-y-3">
                            <div className="rounded-lg border border-accent/30 bg-slate-950/70 p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                        <p className="text-sm font-semibold text-slate-200">{stageLabel}</p>
                                    </div>
                                    <p className="text-xs text-slate-400">Live progress from UVR + sanitizer</p>
                                </div>
                                {/* Progress bars */}
                                <div className="space-y-3">
                                    {/* Overall */}
                                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-accent via-cyan-400 to-accent transition-[width] duration-300"
                                            style={{ width: `${overallPct}%` }}
                                        />
                                    </div>

                                    {/* UVR vocal extraction (when enabled) */}
                                    {sanitizeExtractVocals && (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-between text-xs text-slate-300">
                                                <span>Vocal extraction (UVR)</span>
                                                <span className="text-slate-500">{Math.round(uvrPctRaw)}%</span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-purple-400 via-accent to-cyan-400 transition-[width] duration-200"
                                                    style={{ width: `${Math.max(2, Math.min(100, uvrPctRaw))}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Sanitization / segmentation */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs text-slate-300">
                                            <span>Speech detection & segmentation</span>
                                            <span className="text-slate-500">{Math.round(segmentPctRaw)}%</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-400 via-accent to-cyan-300 transition-[width] duration-200"
                                                style={{ width: `${Math.max(2, Math.min(100, segmentPctRaw))}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Preview rendering */}
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs text-slate-300">
                                            <span>Preview rendering</span>
                                            <span className="text-slate-500">{Math.round(previewPctRaw)}%</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-sky-400 via-cyan-300 to-accent transition-[width] duration-200"
                                                style={{ width: `${Math.max(2, Math.min(100, previewPctRaw))}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
                                        <p className="text-slate-400 text-[11px]">Stage</p>
                                        <p className="text-slate-100 font-medium">
                                            {stageLabel} ┬╖ {overallPct}%
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
                                        <p className="text-slate-400 text-[11px]">Found segments</p>
                                        <p className="text-slate-100 font-mono text-sm">{sanitizeSegmentProgress && sanitizeSegmentProgress >= 100 ? 'finishing' : 'ΓÇª'}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
                                        <p className="text-slate-400 text-[11px]">Voice samples</p>
                                        <p className="text-slate-100 font-mono text-sm">{sanitizeMode === 'voice' ? 'collecting' : 'n/a'}</p>
                                    </div>
                                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1.5">
                                        <p className="text-slate-400 text-[11px]">Duration</p>
                                        <p className="text-slate-100 font-mono text-sm">ΓÇª</p>
                                    </div>
                                </div>
                                {/* Mini Preview Panel */}
                                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                                    <p className="text-xs text-slate-400 mb-2">Live Preview</p>
                                    <div className="flex items-center gap-1 h-12">
                                        {Array.from({ length: 60 }, (_, i) => (
                                            <div
                                                key={i}
                                                className="flex-1 bg-accent/40 rounded-sm transition-all"
                                                style={{
                                                    height: `${Math.abs(Math.sin(i * 0.2)) * 100}%`,
                                                    opacity: i < 24 ? 1 : 0.3
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                                {/* Cancel button */}
                                <button
                                    className="w-full px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-red-500 hover:text-red-400 text-sm transition-all"
                                    onClick={() => showToast('Cancel: not yet implemented')}
                                >
                                    Cancel processing
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Results Summary (done state) */}
                {activeStep.status === 'completed' && (
                    <div className={shellClasses + ' p-4'}>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">Γ£ô</span>
                            <p className="text-sm font-semibold text-emerald-300">Processing complete</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                            <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 hover:border-sky-500/50 transition-colors">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sky-400">≡ƒÄñ</span>
                                    <p className="text-xs text-slate-400">Voice Samples</p>
                                </div>
                                <p className="text-2xl font-bold text-sky-300">{voiceSamples?.length || 0}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {voiceSamples?.reduce((sum, s: any) => sum + (s.duration || 0), 0).toFixed(1)}s total
                                </p>
                            </div>
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 hover:border-emerald-500/50 transition-colors">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-emerald-400">≡ƒôè</span>
                                    <p className="text-xs text-slate-400">Program Segments</p>
                                </div>
                                <p className="text-2xl font-bold text-emerald-300">{sanitizeSegments?.length || 0}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {sanitizeSegments?.reduce((sum, s: any) => sum + (s.duration || 0), 0).toFixed(1)}s total
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setActiveStepIndex(3)}
                            className="w-full px-4 py-3 rounded-lg bg-accent hover:bg-accent/90 text-slate-950 font-semibold text-sm transition-all flex items-center justify-center gap-2 mb-3"
                        >
                            Open review
                            <kbd className="px-2 py-1 rounded bg-slate-950/40 text-xs">Enter</kbd>
                        </button>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            <button
                                onClick={() => {
                                    // Reset to idle
                                    markIdle('sanitize');
                                }}
                                className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-accent hover:text-accent text-sm transition-all flex items-center justify-center gap-1"
                            >
                                <span>≡ƒöü</span> Re-run
                            </button>
                            <button className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-accent hover:text-accent text-sm transition-all flex items-center justify-center gap-1">
                                <span>≡ƒôª</span> Export
                            </button>
                            <button className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-accent hover:text-accent text-sm transition-all flex items-center justify-center gap-1">
                                <span>≡ƒÆ╛</span> Save
                            </button>
                        </div>
                    </div>
                )}

                {/* Auto/Voice Configuration (idle only) */}
                {activeStep.status !== 'running' && activeStep.status !== 'completed' && (
                    <>
                        {sanitizeMode === 'auto' && (
                            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-200">Auto-tune sanitize (recommended)</p>
                                        <p className="text-xs text-slate-500">WeΓÇÖll scan the audio, pick thresholds/gaps, and normalize for TTS.</p>
                                    </div>
                                    <label className="flex items-center gap-2 text-xs">
                                        <span className="text-slate-300">Auto</span>
                                        <input type="checkbox" checked={sanitizeAuto} onChange={(e) => setSanitizeAuto(e.target.checked)} />
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-slate-200">
                                    {['silenceThresholdDb', 'minSegmentMs', 'mergeGapMs', 'targetPeakDb', 'fadeMs'].map((key) => {
                                        const labelMap: any = {
                                            silenceThresholdDb: 'Silence',
                                            minSegmentMs: 'Min seg',
                                            mergeGapMs: 'Merge gap',
                                            targetPeakDb: 'Peak',
                                            fadeMs: 'Fade',
                                        };
                                        const value = (appliedSanitize && appliedSanitize[key]) ?? (key === 'silenceThresholdDb' ? silenceThresholdDb : key === 'minSegmentMs' ? minSegmentMs : key === 'mergeGapMs' ? mergeGapMs : key === 'targetPeakDb' ? targetPeakDb : fadeMs);
                                        const unit = key === 'silenceThresholdDb' || key === 'targetPeakDb' ? 'dB' : 'ms';
                                        return (
                                            <div key={key} className="rounded-lg border border-slate-800 bg-slate-900/60 px-2 py-1">
                                                <p className="text-slate-400 text-[11px]">{labelMap[key]}</p>
                                                <p className="text-slate-100 font-mono text-sm">{value}{unit}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                                {!sanitizeAuto && (
                                    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                                        <p className="text-xs text-slate-400">Manual tweaks (override auto):</p>
                                        <SettingsRow
                                            label="Silence threshold"
                                            unit="dB"
                                            help="Lower = more aggressive trimming"
                                            value={silenceThresholdDb}
                                            min={-60}
                                            max={-10}
                                            step={1}
                                            onChange={setSilenceThresholdDb}
                                            onReset={() => setSilenceThresholdDb(-35)}
                                        />
                                        <SettingsRow
                                            label="Min segment"
                                            unit="ms"
                                            value={minSegmentMs}
                                            min={100}
                                            max={3000}
                                            step={50}
                                            onChange={setMinSegmentMs}
                                            onReset={() => setMinSegmentMs(800)}
                                        />
                                        <SettingsRow
                                            label="Merge gap"
                                            unit="ms"
                                            value={mergeGapMs}
                                            min={50}
                                            max={1200}
                                            step={25}
                                            onChange={setMergeGapMs}
                                            onReset={() => setMergeGapMs(300)}
                                        />
                                        <SettingsRow
                                            label="Target peak"
                                            unit="dB"
                                            value={targetPeakDb}
                                            min={-12}
                                            max={0}
                                            step={1}
                                            onChange={setTargetPeakDb}
                                            onReset={() => setTargetPeakDb(-1)}
                                        />
                                        <SettingsRow
                                            label="Fade"
                                            unit="ms"
                                            value={fadeMs}
                                            min={0}
                                            max={50}
                                            step={1}
                                            onChange={setFadeMs}
                                            onReset={() => setFadeMs(12)}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        {sanitizeMode === 'voice' && (
                            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-slate-200">Voice sample mode</p>
                                        <p className="text-xs text-slate-500">WeΓÇÖll pick 5 strong speech spots, render short clips, and use your picks for TTS voice reference.</p>
                                    </div>
                                </div>
                                {vodMeta && activeStep.status === 'completed' && (
                                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm text-slate-200">Manual selection</p>
                                            <button
                                                className="px-3 py-1.5 rounded bg-accent hover:bg-accent/90 text-black text-xs font-medium"
                                                onClick={() => {
                                                    if (selectionEnd <= selectionStart) {
                                                        showToast('End must be after start');
                                                        return;
                                                    }
                                                    const newSample = {
                                                        start: selectionStart,
                                                        end: selectionEnd,
                                                        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
                                                    };
                                                    setManualSamples(prev => [...prev, newSample]);
                                                    showToast(`Sample added (${(selectionEnd - selectionStart).toFixed(1)}s)`);
                                                }}
                                            >
                                                Take sample
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400">Start (seconds)</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100 text-sm"
                                                    value={selectionStart}
                                                    min={0}
                                                    max={vodMeta.duration}
                                                    step={0.1}
                                                    onChange={(e) => setSelectionStart(parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs text-slate-400">End (seconds)</label>
                                                <input
                                                    type="number"
                                                    className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-100 text-sm"
                                                    value={selectionEnd}
                                                    min={0}
                                                    max={vodMeta.duration}
                                                    step={0.1}
                                                    onChange={(e) => setSelectionEnd(parseFloat(e.target.value) || 0)}
                                                />
                                            </div>
                                        </div>
                                        {manualSamples.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-xs text-slate-300">Reference samples: {manualSamples.length} ┬╖ {manualSamplesDuration.toFixed(1)}s</p>
                                                    <button
                                                        className="text-xs text-slate-400 hover:text-accent"
                                                        onClick={() => setManualSamples([])}
                                                    >
                                                        Clear all
                                                    </button>
                                                </div>
                                                <div className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 text-xs text-blue-200">
                                                    <p>≡ƒÆí Algorithm will analyze these references and find {voiceSampleMaxCount} similar clips matching their duration ({voiceSampleMinDuration}ΓÇô{voiceSampleMaxDuration}s) and loudness (ΓëÑ{voiceSampleMinRmsDb} dB).</p>
                                                </div>
                                                <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
                                                    {manualSamples.map((sample, idx) => (
                                                        <div key={sample.id} className="flex items-center justify-between px-2 py-1 rounded bg-slate-950/60 border border-slate-800 text-xs">
                                                            <span className="text-slate-200">#{idx + 1}: {sample.start.toFixed(1)}s ΓåÆ {sample.end.toFixed(1)}s ({(sample.end - sample.start).toFixed(1)}s)</span>
                                                            <button
                                                                className="text-slate-400 hover:text-red-400"
                                                                onClick={() => setManualSamples(prev => prev.filter(s => s.id !== sample.id))}
                                                            >
                                                                Γ£ò
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-slate-200">Generation parameters</p>
                                        <p className="text-xs text-slate-400">{manualSamples.length > 0 ? 'Refine reference-based search' : 'Auto-generate criteria'}</p>
                                    </div>
                                    <SettingsRow
                                        label="Min duration"
                                        unit="s"
                                        help="Shortest clip to consider"
                                        value={voiceSampleMinDuration}
                                        min={1.0}
                                        max={5.0}
                                        step={0.5}
                                        onChange={setVoiceSampleMinDuration}
                                        onReset={() => setVoiceSampleMinDuration(2.0)}
                                    />
                                    <SettingsRow
                                        label="Max duration"
                                        unit="s"
                                        help="Longest clip to extract"
                                        value={voiceSampleMaxDuration}
                                        min={3.0}
                                        max={10.0}
                                        step={0.5}
                                        onChange={setVoiceSampleMaxDuration}
                                        onReset={() => setVoiceSampleMaxDuration(6.0)}
                                    />
                                    <SettingsRow
                                        label="Min loudness"
                                        unit="dB"
                                        help="Minimum RMS (reject quiet clips)"
                                        value={voiceSampleMinRmsDb}
                                        min={-45}
                                        max={-15}
                                        step={1}
                                        onChange={setVoiceSampleMinRmsDb}
                                        onReset={() => setVoiceSampleMinRmsDb(-35)}
                                    />
                                    <SettingsRow
                                        label="Max samples"
                                        unit=""
                                        help="Number of clips to generate"
                                        value={voiceSampleMaxCount}
                                        min={3}
                                        max={15}
                                        step={1}
                                        onChange={setVoiceSampleMaxCount}
                                        onReset={() => setVoiceSampleMaxCount(8)}
                                    />
                                    <div className="rounded border border-blue-500/30 bg-blue-500/10 p-2 text-xs text-blue-200 space-y-1">
                                        <p className="font-semibold">How it works:</p>
                                        {manualSamples.length > 0 ? (
                                            <p className="text-blue-300/80">Algorithm analyzes your {manualSamples.length} reference region(s), then scans all speech segments to find the top {voiceSampleMaxCount} clips with similar characteristics (duration {voiceSampleMinDuration}ΓÇô{voiceSampleMaxDuration}s, loudness ΓëÑ{voiceSampleMinRmsDb} dB).</p>
                                        ) : (
                                            <p className="text-blue-300/80">Algorithm scans all detected speech segments, filters by duration ({voiceSampleMinDuration}ΓÇô{voiceSampleMaxDuration}s) and loudness (ΓëÑ{voiceSampleMinRmsDb} dB), then picks the top {voiceSampleMaxCount} longest/loudest clips.</p>
                                        )}
                                        <p className="text-blue-300/80">≡ƒÆí Tip: {manualSamples.length > 0 ? 'Adjust sliders to refine the search around your reference regions.' : 'Add reference regions above to guide the algorithm toward specific voice quality.'}</p>
                                    </div>
                                </div>
                                {voiceSamples.length === 0 && manualSamples.length === 0 && <p className="text-xs text-slate-400">Add reference regions above or click "Run sanitize" to auto-generate samples.</p>}
                                {voiceSamples.length === 0 && manualSamples.length > 0 && (
                                    <div className="rounded border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
                                        <p className="font-semibold">Γ£ô {manualSamples.length} reference region(s) set</p>
                                        <p className="text-accent/80">Click "Run sanitize" to find {voiceSampleMaxCount} similar clips matching your references.</p>
                                    </div>
                                )}
                                {voiceSamples.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-200">
                                        {voiceSamples.map((vs, idx) => {
                                            const selected = voiceSelections.includes(vs.path);
                                            return (
                                                <div key={idx} className={`rounded-lg border ${selected ? 'border-accent' : 'border-slate-800'} bg-slate-900/60 p-2 space-y-2`}>
                                                    <div className="flex items-center justify-between">
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                onChange={(e) => {
                                                                    setVoiceSelections((prev) => {
                                                                        if (e.target.checked) {
                                                                            return Array.from(new Set([...prev, vs.path]));
                                                                        }
                                                                        return prev.filter((p) => p !== vs.path);
                                                                    });
                                                                }}
                                                            />
                                                            <span className="font-semibold">Sample {idx + 1}</span>
                                                        </label>
                                                        <span className="text-slate-400">{vs.duration?.toFixed?.(2)}s</span>
                                                    </div>
                                                    <p className="text-slate-400 text-[11px]">rms {vs.rmsDb?.toFixed?.(1)} dB ┬╖ {vs.start?.toFixed?.(2)}s ΓåÆ {vs.end?.toFixed?.(2)}s</p>
                                                    <div className="rounded border border-slate-800 bg-slate-950/60 p-2">
                                                        <audio controls className="w-full mb-2" src={api.artifactUrl(vs.path)} />
                                                        <WaveformBars bars={Array.from({ length: 48 }, (_, i) => Math.abs(Math.sin(i + idx)) * 0.8)} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 space-y-1 text-xs text-slate-300">
                                    <div className="flex items-center justify-between">
                                        {voiceSamples.length > 0 ? (
                                            <>
                                                <span>Generated: {voiceSamples.length} samples ┬╖ Selected: {selectedVoiceSamples.length}</span>
                                                {selectedVoiceSamples.length < 5 && <span className="text-amber-300">Select at least 5 for best quality</span>}
                                            </>
                                        ) : manualSamples.length > 0 ? (
                                            <>
                                                <span>References: {manualSamples.length} regions ┬╖ {manualSamplesDuration.toFixed(1)}s</span>
                                                <span className="text-blue-300">Run sanitize to find similar clips</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>No samples yet</span>
                                                <span className="text-amber-300">Add references or run in auto mode</span>
                                            </>
                                        )}
                                    </div>
                                    <p className="text-slate-500">Aim for 8ΓÇô12 samples, 30ΓÇô90s total. Prefer clean speech (2ΓÇô8s chunks).</p>
                                    <ul className="list-disc list-inside text-slate-500 space-y-1">
                                        <li>Only streamer speaking; avoid loud SFX/music.</li>
                                        <li>Mix normal / excited / quiet moments.</li>
                                        <li>Skip clips under 1.5s or very quiet (&lt;-45 dB).</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Run Button - shown at the end when mode selected */}
                {activeStep.status !== 'running' && activeStep.status !== 'completed' && sanitizeMode && (
                    <div className={shellClasses + ' p-4 animate-fadeIn'} style={{ animationDelay: '0.3s' }}>
                        <button
                            className="w-full px-4 py-3 rounded-lg bg-accent hover:bg-accent/90 text-slate-950 font-semibold disabled:opacity-60 transition-all flex items-center justify-center gap-2"
                            onClick={runSanitize}
                            disabled={!vodMeta}
                        >
                            <span>Run {sanitizeMode === 'auto' ? 'Auto' : 'Manual'} Sanitize</span>
                            <kbd className="px-2 py-1 rounded bg-slate-950/30 text-xs">Ctrl+R</kbd>
                        </button>
                    </div>
                )}

                {/* Preview & Export (shown when completed) */}
                {activeStep.status === 'completed' && (
                    <>
                        <AudioPreviewCard
                            title="Preview"
                            durationSec={sanitizeCleanDuration ?? 0}
                            sampleRate={sanitizePreviewRate ?? 0}
                            isLoading={false}
                            hasError={false}
                        />
                        {sanitizeSegments.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button className="px-3 py-2 rounded-lg border border-slate-700 hover:border-accent hover:text-accent text-sm" onClick={() => setActiveId('review')}>
                                    Review segments ({sanitizeSegments.length})
                                </button>
                                <button className="px-3 py-2 rounded-lg border border-slate-700 hover:border-accent hover:text-accent text-sm" onClick={exportClips}>
                                    Export clips
                                </button>
                            </div>
                        )}
                        {exportClipsPath && (
                            <PathRow label="Clips directory" path={exportClipsPath} onCopy={() => showToast('Copied path')} />
                        )}
                    </>
                )}
            </div>
        );
    };

    const renderReview = () => {
        const trackType = sanitizeExtractVocals ? 'vocal' : 'direct';
        const acceptedCount = Object.values(reviewVotes).filter(v => v === 'accept').length;
        const rejectedCount = Object.values(reviewVotes).filter(v => v === 'reject').length;

        return (
            <div className="space-y-3">
                <div className={shellClasses + ' p-4 space-y-3'}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-lg font-semibold text-slate-100">Review Segments</p>
                            <p className="text-sm text-slate-400">Fast keyboard-driven review: Enter=Accept, Space=Reject, R=Replay</p>
                        </div>
                        <button
                            className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60 hover:bg-accent/90 transition"
                            onClick={() => setShowTinderReview(true)}
                            disabled={sanitizeSegments.length === 0}
                        >
                            {sanitizeSegments.length === 0 ? 'No segments' : 'Start Review'}
                        </button>
                    </div>

                    {sanitizeSegments.length === 0 && (
                        <EmptyState
                            title="No segments yet"
                            body="Run Sanitize first to generate segments for review."
                            cta="Go to Sanitize"
                            onCta={() => setActiveId('sanitize')}
                        />
                    )}

                    {sanitizeSegments.length > 0 && (
                        <>
                            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                    {trackType === 'vocal' ? (
                                        <span className="px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold">
                                            ≡ƒÄñ Reviewing Vocal Track
                                        </span>
                                    ) : (
                                        <span className="px-3 py-1.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold">
                                            ≡ƒöè Reviewing Direct Audio
                                        </span>
                                    )}
                                    <span className="px-2 py-1 rounded-full bg-slate-800 text-slate-300 text-xs">
                                        {sanitizeSegments.length} segments
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2">
                                        <p className="text-xs text-slate-400 mb-1">Total</p>
                                        <p className="text-lg font-bold text-slate-100">{sanitizeSegments.length}</p>
                                    </div>
                                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                                        <p className="text-xs text-slate-400 mb-1">Accepted</p>
                                        <p className="text-lg font-bold text-emerald-300">{acceptedCount}</p>
                                    </div>
                                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
                                        <p className="text-xs text-slate-400 mb-1">Rejected</p>
                                        <p className="text-lg font-bold text-rose-300">{rejectedCount}</p>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-300 space-y-2">
                                    <p className="font-semibold text-slate-200">Keyboard Controls:</p>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
                                        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-accent">Enter</kbd> Accept & next</span>
                                        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-accent">Space</kbd> Reject & next</span>
                                        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-accent">R</kbd> Replay current</span>
                                        <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-accent">Esc</kbd> Exit review</span>
                                    </div>
                                </div>
                            </div>

                            {acceptedCount > 0 && (
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-sm font-semibold text-emerald-300">Ready to proceed</p>
                                    </div>
                                    <p className="text-xs text-emerald-400/80 mt-1">
                                        {acceptedCount} segments accepted. You can now generate SRT subtitles.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderSrt = () => (
        <div className="space-y-3">
            <div className={shellClasses + ' p-4 space-y-3'}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-semibold text-slate-100">5. SRT</p>
                        <p className="text-sm text-slate-400">Generate subtitles.</p>
                        <p className="text-xs text-slate-400 mt-1">
                            Zaakceptowane: {reviewAcceptedIdxs.length} segment├│w ┬╖ ┼ü─àczny czas: {formatHms(reviewAcceptedDuration)}
                        </p>
                    </div>
                    <button
                        className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60"
                        onClick={runSrt}
                        disabled={!vodMeta || activeStep.status === 'running'}
                    >
                        {activeStep.status === 'running' ? 'Running...' : 'Run SRT'}
                    </button>
                </div>
                <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300 space-y-1">
                    <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-200">Input: zaakceptowane segmenty + audio</span>
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-200">Output: plik SRT/napisy</span>
                    </div>
                    <p className="text-slate-400">Generuje napisy na bazie zaakceptowanych fragment├│w; logi techniczne w konsoli na dole.</p>
                </div>
                {activeStep.outputs ? (
                    <div className="space-y-2">
                        {activeStep.outputs.map((o) => <PathRow key={o.path} label={o.label} path={o.path} onCopy={() => showToast('Copied path')} />)}
                        {srtExcerpt && (
                            <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
                                <p className="font-semibold mb-1">Excerpt</p>
                                <pre className="whitespace-pre-wrap leading-relaxed">{srtExcerpt}</pre>
                            </div>
                        )}
                    </div>
                ) : (
                    <EmptyState
                        title="No SRT yet"
                        body={activeStep.status === 'error' ? 'SRT failed. Check console logs and re-run.' : 'Run SRT to generate subtitles.'}
                        cta={activeStep.status === 'error' ? 'Re-run SRT' : undefined}
                        onCta={activeStep.status === 'error' ? runSrt : undefined}
                    />
                )}
            </div>
        </div>
    );

    const renderTrain = () => (
        <div className="space-y-3">
            <div className={shellClasses + ' p-4 space-y-3'}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-semibold text-slate-100">6. Train Voice</p>
                        <p className="text-sm text-slate-400">Build a voice dataset for TTS.</p>
                        <p className="text-xs text-slate-400 mt-1">U┼╝yje zaakceptowanych segment├│w i wygeneruje g┼éos do kroku TTS.</p>
                    </div>
                    <button
                        className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60"
                        onClick={runTrain}
                        disabled={!vodMeta || activeStep.status === 'running'}
                    >
                        {activeStep.status === 'running' ? 'TrainingΓÇª' : 'Run Training'}
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-200">Streamer / Dataset name</label>
                        <input
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                            value={ttsStreamer}
                            onChange={(e) => setTtsStreamer(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">Zostanie u┼╝yty jako nazwa g┼éosu/datasetu.</p>
                    </div>
                    <div className="text-sm text-slate-300 space-y-1">
                        <p className="text-slate-200 font-semibold">Wej┼¢cie</p>
                        <p>Zaakceptowane segmenty: {reviewAcceptedIdxs.length}</p>
                        <p>┼ü─àczny czas: {formatHms(reviewAcceptedDuration)}</p>
                        <p className="text-xs text-slate-500">Upewnij si─Ö, ┼╝e kroki VOD ΓåÆ SRT s─à zako┼äczone.</p>
                    </div>
                </div>

                <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />

                {activeStep.outputs ? (
                    <div className="space-y-2">
                        {activeStep.outputs.map((o) => (
                            <PathRow key={o.path} label={o.label} path={o.path} onCopy={() => showToast('Copied path')} />
                        ))}
                        {activeStep.status === 'done' && (
                            <DiffBanner message="Voice trained. Proceed to TTS." onRerun={runTrain} />
                        )}
                    </div>
                ) : (
                    <EmptyState
                        title={activeStep.status === 'error' ? 'Training failed' : 'No training yet'}
                        body={activeStep.status === 'error' ? 'Check logs and retry.' : 'Run training to build the voice dataset.'}
                        cta={activeStep.status === 'error' ? 'Re-run training' : undefined}
                        onCta={activeStep.status === 'error' ? runTrain : undefined}
                    />
                )}
            </div>
        </div>
    );

    const renderTts = () => (
        <div className="space-y-3">
            <div className={shellClasses + ' p-4 space-y-3'}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-semibold text-slate-100">7. TTS</p>
                        <p className="text-sm text-slate-400">Generate and listen to synthesized voice.</p>
                        <p className="text-xs text-slate-400 mt-1">Input: tekst + g┼éos; Output: plik audio TTS</p>
                    </div>
                    <button
                        className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60"
                        onClick={runTts}
                        disabled={!vodMeta || activeStep.status === 'running'}
                    >
                        {activeStep.status === 'running' ? 'Running...' : 'Run TTS'}
                    </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-200">Streamer</label>
                        <input
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                            value={ttsStreamer}
                            onChange={(e) => setTtsStreamer(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">U┼╝yj identyfikatora datasetu/g┼éosu.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-slate-200">TTS text</label>
                        <textarea
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                            rows={5}
                            value={ttsText}
                            onChange={(e) => setTtsText(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">Tekst, kt├│ry zostanie nagrany g┼éosem streamera.</p>
                    </div>
                </div>

                <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />

                {activeStep.outputs ? (
                    <div className="space-y-3">
                        {activeStep.outputs.map((o) => (
                            <PathRow key={o.path} label={o.label} path={o.path} onCopy={() => showToast('Copied path')} />
                        ))}
                        <DiffBanner message="Ods┼éuchaj wygenerowane audio" onRerun={runTts} />
                    </div>
                ) : (
                    <EmptyState
                        title={activeStep.status === 'error' ? 'TTS failed' : 'No TTS yet'}
                        body={activeStep.status === 'error' ? 'Check logs, adjust text/streamer, and re-run.' : 'Run TTS to generate voice.'}
                        cta={activeStep.status === 'error' ? 'Re-run TTS' : undefined}
                        onCta={activeStep.status === 'error' ? runTts : undefined}
                    />
                )}
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeId) {
            case 'vod':
                return renderVod();
            case 'sanitize':
                return renderSanitize();
            case 'review':
                return renderReview();
            case 'srt':
                return renderSrt();
            case 'train':
                return renderTrain();
            case 'tts':
                return renderTts();
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
            <div className="w-full max-w-7xl mx-auto px-4 py-6 flex-1">
                <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-12 md:col-span-3 space-y-3">
                        <Sidebar steps={steps} activeId={activeId} onSelect={(id) => setActiveId(id as StepId)} />
                    </div>
                    <div className="col-span-12 md:col-span-9 space-y-3">
                        <MiniStepper steps={steps} activeId={activeId} onSelect={(id) => setActiveId(id as StepId)} />
                        {renderContent()}
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-800 bg-slate-950/95 backdrop-blur">
                <ConsolePanel
                    logs={logs}
                    collapsed={consoleCollapsed}
                    follow={followLogs}
                    onToggleCollapse={() => setConsoleCollapsed((v) => !v)}
                    onToggleFollow={() => setFollowLogs((v) => !v)}
                />
            </div>

            <div className="w-full border-t border-slate-800 bg-slate-950">
                <FooterNav onPrev={goPrev} onNext={goNext} canPrev={canPrev} canNext={canNext} helper={helperLine} />
            </div>

            {toast && <Toast message={toast} />}

            {showTinderReview && (
                <TinderReview
                    segments={sanitizeSegments}
                    audioSrc={segmentAudioPath ? api.artifactUrl(segmentAudioPath) : undefined}
                    trackType={sanitizeExtractVocals ? 'vocal' : 'direct'}
                    onClose={() => setShowTinderReview(false)}
                    onComplete={(votes) => {
                        setReviewVotes(votes);
                        const acceptedIds = Object.keys(votes).filter(k => votes[Number(k)] === 'accept').map(Number);
                        const acceptedDuration = acceptedIds.reduce((sum, idx) => {
                            const seg = sanitizeSegments[idx];
                            return sum + (seg?.duration || 0);
                        }, 0);
                        setReviewAcceptedIdxs(acceptedIds);
                        setReviewAcceptedDuration(acceptedDuration);
                        setShowTinderReview(false);

                        // Unlock SRT step if any clips were accepted
                        if (acceptedIds.length > 0) {
                            setSteps(prev => lockChain(prev.map(s =>
                                s.id === 'srt' ? { ...s, ready: true } : s
                            )));
                            showToast(`Review complete: ${acceptedIds.length} segments accepted`);
                        } else {
                            showToast('No segments accepted');
                        }
                    }}
                />
            )}

            {showPresetModal && (
                <PresetModal
                    mode={presetModalMode}
                    currentPresets={customPresets}
                    onClose={() => setShowPresetModal(false)}
                    onSaveAs={(name) => {
                        savePreset(name);
                        setSanitizePreset(name);
                        setShowPresetModal(false);
                    }}
                    onDelete={(name) => {
                        deletePreset(name);
                        if (sanitizePreset === name) {
                            setSanitizePreset('Balanced');
                            loadPreset('Balanced');
                        }
                    }}
                />
            )}
        </div>
    );
}
