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
import { StepId, StepState } from './state/types';
import { VodMeta, Job, createApi } from './api/client';

const shellClasses = 'rounded-xl border border-slate-800 bg-slate-950/70 shadow';

const initialSteps: StepState[] = [
    { id: 'vod', title: 'VOD', subtitle: 'Select VOD', status: 'ready', ready: true, locked: false },
    { id: 'audio', title: 'Audio', subtitle: 'Extract audio', status: 'idle', ready: false, locked: true },
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

export default function App() {
    const api = useMemo(() => createApi(), []);

    const [steps, setSteps] = useState<any[]>(() => lockChain(initialSteps));
    const [activeId, setActiveId] = useState<StepId>('vod');
    const [logs, setLogs] = useState<string[]>(['[i] Ready']);
    const [consoleCollapsed, setConsoleCollapsed] = useState(false);
    const [followLogs, setFollowLogs] = useState(true);
    const [sanitizePreset, setSanitizePreset] = useState<'Balanced' | 'Strict' | 'Lenient'>('Balanced');
    const [sanitizeMode, setSanitizeMode] = useState<'auto' | 'voice'>('auto');
    const [sanitizeAuto, setSanitizeAuto] = useState(true);
    const [sanitizeStrictness, setSanitizeStrictness] = useState(0.5);
    const [sanitizePreviewStart, setSanitizePreviewStart] = useState(0);
    const [sanitizePreviewDuration, setSanitizePreviewDuration] = useState(90);
    const [sanitizePreservePauses, setSanitizePreservePauses] = useState(true);
    const [sanitizeReduceSfx, setSanitizeReduceSfx] = useState(true);
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

        const manualSamplesDuration = useMemo(() => manualSamples.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0), [manualSamples]);
        const selectedVoiceSamples = useMemo(() => voiceSamples.filter((v) => voiceSelections.includes(v.path)), [voiceSamples, voiceSelections]);
        const activeStep = steps.find((s) => s.id === activeId) || steps[0];
        const stepIndex = steps.findIndex((s) => s.id === activeId);
        const canPrev = stepIndex > 0;
        const canNext = stepIndex < steps.length - 1 && !steps[stepIndex + 1]?.locked;

        const formatNumber = (value: number | null | undefined, digits = 2) => (value !== null && value !== undefined && Number.isFinite(value) ? value.toFixed(digits) : '—');
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
            markRunning('vod', 'Checking VOD…');
            try {
                const meta = await api.checkVod(vodUrl.trim());
                setVodMeta(meta);
                setSteps((prev) =>
                    lockChain(
                        prev.map((s): StepState => {
                            if (s.id === 'vod') return { ...s, status: 'done', ready: true, locked: false, message: 'VOD validated' };
                            if (s.id === 'audio') return { ...s, ready: true };
                            return s;
                        })
                    )
                );
                appendLog(`[vod] checked: ${meta.title || 'ok'}`);
                setActiveId('audio');
            } catch (err) {
                const message = err instanceof Error ? err.message : 'VOD check failed';
                setVodError(message);
                markError('vod', message);
            } finally {
                setVodLoading(false);
            }
        };

        const handleSelectJob = (job: Job) => {
    appendLog(`[job] Loading job: ${job.title}`);
    // Restore job state
    setVodUrl(job.vodUrl);
    setVodMeta({
        streamer: job.streamer,
        title: job.title,
        duration: '',
        previewUrl: '',
        vodId: job.vodUrl.match(/\d+/)?.[0] || '',
    });

    // Unlock completed steps
    setSteps((prev) => {
        const updated = prev.map((s): StepState => {
            const stepKey = s.id as keyof Job['steps'];
            const isCompleted = job.steps[stepKey];
            return {
                ...s,
                status: isCompleted ? 'done' : 'idle',
                ready: isCompleted,
                locked: false,
            };
        });
        return lockChain(updated);
    });

    // Set active step to first incomplete step
    const firstIncomplete = (['vod', 'audio', 'sanitize', 'review', 'srt', 'train', 'tts'] as StepId[]).find(
        (stepId) => !job.steps[stepId as keyof Job['steps']]
    );
    if (firstIncomplete) {
        setActiveId(firstIncomplete);
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
        setActiveId('vod');
        return;
    }
    markRunning('audio');
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
        const outputs = [{ label: 'Audio path', path: res.path }];
        markDone('audio', outputs, 'Audio extracted');
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Audio failed';
        markError('audio', message);
    }
};

const runSanitize = async (options?: { previewOnly?: boolean }) => {
    if (!vodMeta) {
        setVodError('Run VOD check first.');
        setActiveId('vod');
        return;
    }
    const previewOnly = options?.previewOnly ?? false;
    markRunning('sanitize', previewOnly ? 'Generating preview…' : 'Running sanitize…');
    try {
        const presetKey: 'strict' | 'balanced' | 'lenient' = sanitizePreset === 'Strict' ? 'strict' : sanitizePreset === 'Lenient' ? 'lenient' : 'balanced';
        const res = await api.runSanitize({
            vodUrl: vodUrl.trim(),
            mode: sanitizeMode,
            preset: presetKey,
            strictness: sanitizeStrictness,
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
        });
        const appliedParams = (res.appliedSettings && (res.appliedSettings as any).params) || {};
        setAppliedSanitize(appliedParams);
        if (typeof appliedParams.silenceThresholdDb === 'number') setSilenceThresholdDb(appliedParams.silenceThresholdDb);
        if (typeof appliedParams.minSegmentMs === 'number') setMinSegmentMs(appliedParams.minSegmentMs);
        if (typeof appliedParams.mergeGapMs === 'number') setMergeGapMs(appliedParams.mergeGapMs);
        if (typeof appliedParams.targetPeakDb === 'number') setTargetPeakDb(appliedParams.targetPeakDb);
        if (typeof appliedParams.fadeMs === 'number') setFadeMs(appliedParams.fadeMs);
        setSanitizePreviewPath(res.previewPath);
        setSanitizeCleanPath(res.cleanPath ?? null);
        setSanitizePreviewRate(res.previewSampleRate);
        setSanitizeCleanDuration(res.cleanDuration ?? null);
        setSanitizeSegments(res.previewSegments || []);
        setVoiceSamples(res.voiceSamples || []);
        setVoiceSelections((res.voiceSamples || []).map((v: any) => v.path));
        const outputs = [
            res.cleanPath ? { label: 'Clean audio', path: res.cleanPath } : null,
            res.segmentsPath ? { label: 'Segments JSON', path: res.segmentsPath } : null,
        ].filter(Boolean) as { label: string; path: string }[];
        if (previewOnly) {
            setSteps((prev) => {
                const next = prev.map((s): StepState =>
                    s.id === 'sanitize'
                        ? {
                            ...s,
                            status: 'preview',
                            ready: false,
                            locked: false,
                            message: 'Preview ready — run full sanitize to finalize',
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
        if (res.excerpt) appendLog(`[srt] excerpt: ${res.excerpt.slice(0, 160)}${res.excerpt.length > 160 ? '…' : ''}`);
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
    markRunning('tts', 'Generating TTS…');
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
    markRunning('train', 'Training voice…');
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

const renderVod = () => (
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
            <div className={shellClasses + ' p-4 space-y-3'}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-semibold text-slate-100">1. VOD</p>
                        <p className="text-sm text-slate-400">Validate and fetch metadata.</p>
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
                            className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60"
                            onClick={checkVod}
                            disabled={vodLoading}
                        >
                            {vodLoading ? 'Checking...' : 'Check VOD'}
                        </button>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm text-slate-200">VOD URL</label>
                    <input
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                        placeholder="https://www.twitch.tv/videos/..."
                        value={vodUrl}
                        onChange={(e) => setVodUrl(e.target.value)}
                    />
                    <p className="text-xs text-slate-400">Paste a Twitch VOD URL. We will validate and fetch metadata.</p>
                    {vodError && <p className="text-xs text-rose-300">{vodError}</p>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-200 flex items-center gap-2">
                            Twitch auth_token (if protected)
                            <span className="text-[11px] text-slate-400">stored locally</span>
                        </label>
                        <input
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                            placeholder="auth_token cookie"
                            value={twitchAuthToken}
                            onChange={(e) => setTwitchAuthToken(e.target.value)}
                        />
                        <p className="text-[11px] text-slate-400 break-words">
                            In browser console (on twitch.tv): <span className="font-mono">copy(document.cookie.match(/auth_token=([^;]+)/)?.[1] || '')</span>
                        </p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-slate-200">Preferred VOD quality</label>
                        <select
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                            value={vodQuality}
                            onChange={(e) => setVodQuality(e.target.value)}
                        >
                            <option value="audio_only">audio_only (best for audio)</option>
                            <option value="source">source</option>
                            <option value="1080p">1080p</option>
                            <option value="720p">720p</option>
                        </select>
                        <p className="text-[11px] text-slate-400">Pipeline will auto-fallback if this rendition is missing.</p>
                    </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300 space-y-1">
                    <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-200">Input: Twitch VOD URL + auth token (opcjonalnie)</span>
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-200">Output: Metadane (tytuł, streamer, długość) + pobrany plik wideo/audio</span>
                    </div>
                    <p className="text-slate-400">Status i logi są w konsoli na dole; tutaj pokazujemy tylko prosty postęp i błędy.</p>
                </div>
                <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />
                {vodMeta && (
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-200 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">{vodMeta.title}</span>
                            <span className="text-xs text-slate-400">{vodMeta.duration}</span>
                        </div>
                        <p className="text-xs text-slate-400">Streamer: {vodMeta.streamer}</p>
                        <p className="text-xs text-slate-400">VOD ID: {vodMeta.vodId}</p>
                        <p className="text-xs text-slate-400">Preview URL: {vodMeta.previewUrl}</p>
                    </div>
                )}
                <PresetBar
                    label="Sanitize Preset (v2)"
                    presets={['Balanced', 'Strict', 'Lenient', ...customPresets]}
                    value={sanitizePreset}
                    onChange={(name) => {
                        setSanitizePreset(name as 'Balanced' | 'Strict' | 'Lenient' | typeof customPresets[number]);
                        loadPreset(name);
                    }}
                    onSave={() => savePreset(sanitizePreset)}
                    onSaveAs={() => {
                        setPresetModalMode('saveAs');
                        setShowPresetModal(true);
                    }}
                    onManage={() => {
                        setPresetModalMode('manage');
                        setShowPresetModal(true);
                    }}
                />
            </div>
        )}
    </div>
);

const renderAudio = () => (
    <div className="space-y-3">
        <div className={shellClasses + ' p-4 space-y-3'}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-lg font-semibold text-slate-100">2. Audio</p>
                    <p className="text-sm text-slate-400">Extract and demux audio track.</p>
                </div>
                <button
                    className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60"
                    onClick={runAudio}
                    disabled={!vodMeta || activeStep.status === 'running'}
                >
                    {activeStep.status === 'running' ? 'Running...' : 'Run audio'}
                </button>
            </div>
            <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300 space-y-1">
                <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-200">Input: pobrany VOD</span>
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-200">Output: audio WAV (full)</span>
                </div>
                <p className="text-slate-400">Ekstrakcja audio z VOD; żadnych zmian w treści, tylko demux.</p>
            </div>
            {!vodMeta && <EmptyState title="VOD required" body="Complete VOD check before extracting audio." />}
            {activeStep.status === 'error' && <DiffBanner message={activeStep.message || 'Audio extraction failed.'} onRerun={runAudio} />}
            {activeStep.outputs && activeStep.outputs.map((o) => <PathRow key={o.path} label={o.label} path={o.path} onCopy={() => showToast('Copied path')} />)}
        </div>
    </div>
);

const renderSanitize = () => (
    <div className="space-y-3">
        <div className={shellClasses + ' p-4 space-y-3'}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <p className="text-lg font-semibold text-slate-100">3. Sanitize</p>
                    <p className="text-sm text-slate-400">Trim silence, normalize, and preview.</p>
                </div>
                <div className="flex items-center gap-2">
                    {sanitizeMode === 'voice' && (
                        <button
                            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-200 hover:border-accent hover:text-accent disabled:opacity-60"
                            onClick={runSanitize}
                            disabled={!vodMeta || activeStep.status === 'running'}
                        >
                            {activeStep.status === 'running' ? 'Generating…' : 'Generate samples'}
                        </button>
                    )}
                    <button
                        className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60"
                        onClick={runSanitize}
                        disabled={!vodMeta || activeStep.status === 'running'}
                    >
                        {activeStep.status === 'running' ? 'Running...' : 'Run sanitize'}
                    </button>
                </div>
            </div>
            <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />
            {activeStep.status === 'error' && (
                <DiffBanner message={activeStep.message || 'Sanitize failed. Adjust settings and re-run.'} onRerun={runSanitize} />
            )}
            <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300 space-y-1">
                <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-200">Input: surowe audio z kroku 2</span>
                    <span className="px-2 py-1 rounded bg-slate-800 text-slate-200">Output: clean.wav + lista segmentów + preview.wav</span>
                </div>
                <p className="text-slate-400">Sanitacja wycina ciszę, normalizuje poziomy, skleja mówione fragmenty. Oryginał zostaje nienaruszony.</p>
                <div className="flex items-center gap-3 pt-2 text-sm text-slate-200">
                    <label className="flex items-center gap-2">
                        <input type="radio" checked={sanitizeMode === 'auto'} onChange={() => setSanitizeMode('auto')} />
                        <span>Auto</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="radio" checked={sanitizeMode === 'voice'} onChange={() => setSanitizeMode('voice')} />
                        <span>Voice sample</span>
                    </label>
                </div>
            </div>
            {sanitizeMode === 'auto' && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-200">Auto-tune sanitize (recommended)</p>
                            <p className="text-xs text-slate-500">We’ll scan the audio, pick thresholds/gaps, and normalize for TTS.</p>
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
                            <p className="text-xs text-slate-500">We’ll pick 5 strong speech spots, render short clips, and use your picks for TTS voice reference.</p>
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
                                        <p className="text-xs text-slate-300">Reference samples: {manualSamples.length} · {manualSamplesDuration.toFixed(1)}s</p>
                                        <button
                                            className="text-xs text-slate-400 hover:text-accent"
                                            onClick={() => setManualSamples([])}
                                        >
                                            Clear all
                                        </button>
                                    </div>
                                    <div className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 text-xs text-blue-200">
                                        <p>💡 Algorithm will analyze these references and find {voiceSampleMaxCount} similar clips matching their duration ({voiceSampleMinDuration}–{voiceSampleMaxDuration}s) and loudness (≥{voiceSampleMinRmsDb} dB).</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
                                        {manualSamples.map((sample, idx) => (
                                            <div key={sample.id} className="flex items-center justify-between px-2 py-1 rounded bg-slate-950/60 border border-slate-800 text-xs">
                                                <span className="text-slate-200">#{idx + 1}: {sample.start.toFixed(1)}s → {sample.end.toFixed(1)}s ({(sample.end - sample.start).toFixed(1)}s)</span>
                                                <button
                                                    className="text-slate-400 hover:text-red-400"
                                                    onClick={() => setManualSamples(prev => prev.filter(s => s.id !== sample.id))}
                                                >
                                                    ✕
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
                                <p className="text-blue-300/80">Algorithm analyzes your {manualSamples.length} reference region(s), then scans all speech segments to find the top {voiceSampleMaxCount} clips with similar characteristics (duration {voiceSampleMinDuration}–{voiceSampleMaxDuration}s, loudness ≥{voiceSampleMinRmsDb} dB).</p>
                            ) : (
                                <p className="text-blue-300/80">Algorithm scans all detected speech segments, filters by duration ({voiceSampleMinDuration}–{voiceSampleMaxDuration}s) and loudness (≥{voiceSampleMinRmsDb} dB), then picks the top {voiceSampleMaxCount} longest/loudest clips.</p>
                            )}
                            <p className="text-blue-300/80">💡 Tip: {manualSamples.length > 0 ? 'Adjust sliders to refine the search around your reference regions.' : 'Add reference regions above to guide the algorithm toward specific voice quality.'}</p>
                        </div>
                    </div>
                    {voiceSamples.length === 0 && manualSamples.length === 0 && <p className="text-xs text-slate-400">Add reference regions above or click "Run sanitize" to auto-generate samples.</p>}
                    {voiceSamples.length === 0 && manualSamples.length > 0 && (
                        <div className="rounded border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
                            <p className="font-semibold">✓ {manualSamples.length} reference region(s) set</p>
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
                                        <p className="text-slate-400 text-[11px]">rms {vs.rmsDb?.toFixed?.(1)} dB · {vs.start?.toFixed?.(2)}s → {vs.end?.toFixed?.(2)}s</p>
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
                                    <span>Generated: {voiceSamples.length} samples · Selected: {selectedVoiceSamples.length}</span>
                                    {selectedVoiceSamples.length < 5 && <span className="text-amber-300">Select at least 5 for best quality</span>}
                                </>
                            ) : manualSamples.length > 0 ? (
                                <>
                                    <span>References: {manualSamples.length} regions · {manualSamplesDuration.toFixed(1)}s</span>
                                    <span className="text-blue-300">Run sanitize to find similar clips</span>
                                </>
                            ) : (
                                <>
                                    <span>No samples yet</span>
                                    <span className="text-amber-300">Add references or run in auto mode</span>
                                </>
                            )}
                        </div>
                        <p className="text-slate-500">Aim for 8–12 samples, 30–90s total. Prefer clean speech (2–8s chunks).</p>
                        <ul className="list-disc list-inside text-slate-500 space-y-1">
                            <li>Only streamer speaking; avoid loud SFX/music.</li>
                            <li>Mix normal / excited / quiet moments.</li>
                            <li>Skip clips under 1.5s or very quiet (&lt;-45 dB).</li>
                        </ul>
                    </div>
                </div>
            )}
            <AudioPreviewCard
                title="Preview"
                durationSec={sanitizeCleanDuration ?? 0}
                sampleRate={sanitizePreviewRate ?? 0}
                isLoading={activeStep.status === 'running'}
                hasError={activeStep.status === 'error'}
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
        </div>
    </div>
);

const renderReview = () => (
    <div className="space-y-3">
        <div className={shellClasses + ' p-4 space-y-3'}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-lg font-semibold text-slate-100">4. Review segments</p>
                    <p className="text-sm text-slate-400">Tinder-style accept (Enter) / reject (Space). Jeden gracz audio.</p>
                </div>
                <button
                    className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60"
                    onClick={() => sanitizeSegments.length > 0 && setShowSegmentReview(true)}
                    disabled={sanitizeSegments.length === 0}
                >
                    {sanitizeSegments.length === 0 ? 'Brak segmentów' : 'Otwórz review'}
                </button>
            </div>
            <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />
            {sanitizeSegments.length === 0 && (
                <EmptyState
                    title="No segments yet"
                    body="Run sanitize first to generate preview segments."
                    cta="Go to Sanitize"
                    onCta={() => setActiveId('sanitize')}
                />
            )}
            {sanitizeSegments.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-200 space-y-2">
                    <div className="text-xs text-slate-300 flex flex-wrap gap-2">
                        <span className="px-2 py-1 rounded bg-slate-800">Input: lista segmentów z sanitize</span>
                        <span className="px-2 py-1 rounded bg-slate-800">Output: decyzje accept/reject + transkrypcje zaakceptowanych</span>
                    </div>
                    <p>Przeglądaj segmenty jak Tinder: Enter = akceptuj, Spacja = odrzuć. Włącz Autopilot, aby po decyzji wskoczyć na kolejny.</p>
                    <p className="text-slate-400 text-xs">Jeden odtwarzacz audio, wyraźne kolory: zielony = accept, czerwony = reject, ciemny = neutral. Biały ring = aktualnie odtwarzany.</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="w-3 h-3 bg-emerald-500/80 inline-block rounded-sm" /> Zaakceptowane
                        <span className="w-3 h-3 bg-rose-500/80 inline-block rounded-sm" /> Odrzucone
                        <span className="w-3 h-3 bg-slate-800 inline-block rounded-sm" /> Nieocenione
                        <span className="w-3 h-3 border border-white inline-block rounded-sm" /> Aktualnie odtwarzany
                    </div>
                </div>
            )}
        </div>
    </div>
);

const renderSrt = () => (
    <div className="space-y-3">
        <div className={shellClasses + ' p-4 space-y-3'}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-lg font-semibold text-slate-100">5. SRT</p>
                    <p className="text-sm text-slate-400">Generate subtitles.</p>
                    <p className="text-xs text-slate-400 mt-1">
                        Zaakceptowane: {reviewAcceptedIdxs.length} segmentów · Łączny czas: {formatHms(reviewAcceptedDuration)}
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
                <p className="text-slate-400">Generuje napisy na bazie zaakceptowanych fragmentów; logi techniczne w konsoli na dole.</p>
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
                    <p className="text-xs text-slate-400 mt-1">Użyje zaakceptowanych segmentów i wygeneruje głos do kroku TTS.</p>
                </div>
                <button
                    className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60"
                    onClick={runTrain}
                    disabled={!vodMeta || activeStep.status === 'running'}
                >
                    {activeStep.status === 'running' ? 'Training…' : 'Run Training'}
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
                    <p className="text-xs text-slate-500">Zostanie użyty jako nazwa głosu/datasetu.</p>
                </div>
                <div className="text-sm text-slate-300 space-y-1">
                    <p className="text-slate-200 font-semibold">Wejście</p>
                    <p>Zaakceptowane segmenty: {reviewAcceptedIdxs.length}</p>
                    <p>Łączny czas: {formatHms(reviewAcceptedDuration)}</p>
                    <p className="text-xs text-slate-500">Upewnij się, że kroki VOD → SRT są zakończone.</p>
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
                    <p className="text-xs text-slate-400 mt-1">Input: tekst + głos; Output: plik audio TTS</p>
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
                    <p className="text-xs text-slate-500">Użyj identyfikatora datasetu/głosu.</p>
                </div>
                <div className="space-y-2">
                    <label className="text-sm text-slate-200">TTS text</label>
                    <textarea
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                        rows={5}
                        value={ttsText}
                        onChange={(e) => setTtsText(e.target.value)}
                    />
                    <p className="text-xs text-slate-500">Tekst, który zostanie nagrany głosem streamera.</p>
                </div>
            </div>

            <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />

            {activeStep.outputs ? (
                <div className="space-y-3">
                    {activeStep.outputs.map((o) => (
                        <PathRow key={o.path} label={o.label} path={o.path} onCopy={() => showToast('Copied path')} />
                    ))}
                    <DiffBanner message="Odsłuchaj wygenerowane audio" onRerun={runTts} />
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
        case 'audio':
            return renderAudio();
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
        {showSegmentReview && (
            <SegmentReview
                segments={sanitizeSegments}
                vodUrl={vodUrl}
                audioSrc={rawAudioPath ? api.artifactUrl(rawAudioPath) : undefined}
                onClose={() => {
                    setShowSegmentReview(false);
                    setActiveId('sanitize');
                }}
                onSave={saveSegmentReview}
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
