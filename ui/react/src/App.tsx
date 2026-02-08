// @ts-nocheck
import React, { useMemo, useState, useEffect } from 'react';
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

const initialSteps = [
    { id: 'vod', title: 'VOD', subtitle: 'Validate and fetch metadata', status: 'idle', ready: false, locked: false },
    { id: 'audio', title: 'Audio', subtitle: 'Extract and demux', status: 'idle', ready: false, locked: true },
    { id: 'sanitize', title: 'Sanitize', subtitle: 'Trim silence and normalize', status: 'idle', ready: false, locked: true },
    { id: 'review', title: 'Review', subtitle: 'Accept/reject segments', status: 'idle', ready: false, locked: true },
    { id: 'srt', title: 'SRT', subtitle: 'Generate subtitles', status: 'idle', ready: false, locked: true },
    { id: 'tts', title: 'TTS', subtitle: 'Synthesize voice', status: 'idle', ready: false, locked: true },
] satisfies StepState[];

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
    const [sanitizePreset, setSanitizePreset] = useState('Default');
    const [vodUrl, setVodUrl] = useState('');
    const [vodMeta, setVodMeta] = useState<VodMeta | null>(null);
    const [vodError, setVodError] = useState<string | null>(null);
    const [vodLoading, setVodLoading] = useState(false);
    const [ttsText, setTtsText] = useState('Sample line for TTS.');
    const [ttsStreamer, setTtsStreamer] = useState('juggernautjason');
    const [srtExcerpt, setSrtExcerpt] = useState<string | null>(null);
    const [sanitizePreviewPath, setSanitizePreviewPath] = useState<string | null>(null);
    const [sanitizePreviewRate, setSanitizePreviewRate] = useState<number | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [sanitizeDrawerOpen, setSanitizeDrawerOpen] = useState(false);
    const [silenceThresholdDb, setSilenceThresholdDb] = useState(-35);
    const [minSegmentMs, setMinSegmentMs] = useState(800);
    const [mergeGapMs, setMergeGapMs] = useState(300);
    const [targetPeakDb, setTargetPeakDb] = useState(-1);
    const [fadeMs, setFadeMs] = useState(12);
    const [sanitizeSegments, setSanitizeSegments] = useState<any[]>([]);
    const [sanitizeCleanPath, setSanitizeCleanPath] = useState<string | null>(null);
    const [showSegmentReview, setShowSegmentReview] = useState(false);
    const [exportClipsPath, setExportClipsPath] = useState<string | null>(null);
    const [showVoiceLab, setShowVoiceLab] = useState(false);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [presetModalMode, setPresetModalMode] = useState<'saveAs' | 'manage'>('saveAs');
    const [twitchAuthToken, setTwitchAuthToken] = useState(() => localStorage.getItem('twitchAuthToken') || '');
    const [vodQuality, setVodQuality] = useState(() => localStorage.getItem('vodQuality') || 'audio_only');
    const [rawAudioPath, setRawAudioPath] = useState<string | null>(null);
    const [customPresets, setCustomPresets] = useState<string[]>(() => {
        const stored = localStorage.getItem('sanitizePresets');
        return stored ? JSON.parse(stored) : [];
    });
    const [jobs, setJobs] = useState<Job[]>([]);
    const [showJobList, setShowJobList] = useState(true);
    const [jobsLoading, setJobsLoading] = useState(true);

    const activeStep = useMemo(() => steps.find((s) => s.id === activeId) ?? steps[0], [steps, activeId]);

    const stepIndex = steps.findIndex((s) => s.id === activeId);
    const canPrev = stepIndex > 0;
    const canNext = stepIndex < steps.length - 1 && !steps[stepIndex + 1].locked;

    const helperLine = activeStep?.status === 'running'
        ? 'Step is running… check Console for details.'
        : activeStep?.status === 'error'
            ? 'Resolve error to proceed.'
            : !canNext && stepIndex < steps.length - 1
                ? 'Unlock condition: complete previous step.'
                : 'Use Next/Previous to navigate.';

    // Keyboard shortcuts for wizard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if typing in input/textarea or if modals are open
            if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
            if (showSegmentReview || showPresetModal || showVoiceLab) return;

            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'ArrowRight':
                        e.preventDefault();
                        if (canNext) goNext();
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        if (canPrev) goPrev();
                        break;
                    case 'r':
                    case 'R':
                        e.preventDefault();
                        // Rerun current step based on activeId
                        if (activeId === 'vod') checkVod();
                        else if (activeId === 'audio') runAudio();
                        else if (activeId === 'sanitize') runSanitize();
                        else if (activeId === 'srt') runSrt();
                        else if (activeId === 'tts') runTts();
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canNext, canPrev, activeId, showSegmentReview, showPresetModal, showVoiceLab]);

    // Entering the Review step opens the segment-review overlay when segments exist.
    useEffect(() => {
        if (activeId === 'review' && sanitizeSegments.length > 0) {
            setShowSegmentReview(true);
        } else {
            setShowSegmentReview(false);
        }
    }, [activeId, sanitizeSegments.length]);

    // Load jobs on mount
    useEffect(() => {
        const loadJobs = async () => {
            try {
                const fetchedJobs = await api.getJobs();
                setJobs(fetchedJobs);
                setShowJobList(fetchedJobs.length > 0);
            } catch (err) {
                appendLog('[jobs] Failed to load jobs');
            } finally {
                setJobsLoading(false);
            }
        };
        loadJobs();
    }, [api]);

    useEffect(() => {
        localStorage.setItem('twitchAuthToken', twitchAuthToken);
    }, [twitchAuthToken]);

    useEffect(() => {
        localStorage.setItem('vodQuality', vodQuality);
    }, [vodQuality]);

    const appendLog = (line: string) => setLogs((prev) => [...prev, line]);

    const markRunning = (id: StepId, message = 'Processing…') => {
        setSteps((prev) =>
            lockChain(
                prev.map((s): StepState =>
                    s.id === id
                        ? { ...s, status: 'running' as const, message, exitCode: undefined }
                        : s
                )
            ) as StepState[]
        );
        appendLog(`[run] ${id} started`);
    };

    const markDone = (id: StepId, outputs?: StepState['outputs'], message = 'Completed successfully') => {
        setSteps((prev) => {
            const next = prev.map((s): StepState =>
                s.id === id
                    ? {
                        ...s,
                        status: 'done' as const,
                        ready: true,
                        locked: false,
                        message,
                        exitCode: 0,
                        outputs,
                    }
                    : s
            );
            return lockChain(next) as StepState[];
        });
        appendLog(`[done] ${id} finished`);
    };

    const markError = (id: StepId, message = 'Something went wrong') => {
        setSteps((prev) => lockChain(prev.map((s): StepState => (s.id === id ? { ...s, status: 'error' as const, message, exitCode: 1 } : s))) as StepState[]);
        appendLog(`[error] ${id} failed: ${message}`);
    };

    const showToast = (message: string) => {
        setToast(message);
        setTimeout(() => setToast(null), 2200);
    };

    const exportClips = async () => {
        if (!vodMeta) {
            appendLog('[export] VOD required');
            return;
        }
        appendLog('[export] exporting clips...');
        try {
            const res = await api.exportClips({ vodUrl: vodUrl.trim() });
            setExportClipsPath(res.clipsDir);
            showToast(`Exported ${res.count} clips`);
            appendLog(`[export] ${res.count} clips -> ${res.clipsDir}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Export failed';
            appendLog(`[export] error: ${message}`);
        }
    };

    const saveSegmentReview = async (accepted: number[], rejected: number[]) => {
        if (!vodMeta) return;
        appendLog(`[review] save: ${accepted.length} accepted, ${rejected.length} rejected`);
        try {
            await api.saveSegmentReview({
                vodUrl: vodUrl.trim(),
                totalSegments: sanitizeSegments.length,
                reviewIndex: 0,
                votes: [...accepted.map((i) => ({ index: i, decision: 'accept' as const, segment: sanitizeSegments[i] })), ...rejected.map((i) => ({ index: i, decision: 'reject' as const, segment: sanitizeSegments[i] }))],
            });
            showToast('Review saved');
            markDone('review', undefined, 'Review saved');
            setShowSegmentReview(false);
            setActiveId('srt');
        } catch (err) {
            appendLog('[review] save failed');
        }
    };

    const runVoiceLab = async (params: { useAccepted: boolean; iterations: number }) => {
        appendLog(`[voicelab] training started (${params.iterations} iterations, acceptedOnly=${params.useAccepted})`);
        try {
            // TODO: Integrate with API when available
            await new Promise((resolve) => setTimeout(resolve, 3000));
            appendLog('[voicelab] training complete');
            showToast('Voice Lab completed');
            setShowVoiceLab(false);
        } catch (err) {
            appendLog('[voicelab] training failed');
            showToast('Voice Lab failed');
        }
    };

    const savePreset = (name: string) => {
        const presetData = {
            silenceThresholdDb,
            minSegmentMs,
            mergeGapMs,
            targetPeakDb,
            fadeMs,
        };
        localStorage.setItem(`sanitizePreset_${name}`, JSON.stringify(presetData));
        if (!['Default', 'Aggressive', 'Broadcast'].includes(name) && !customPresets.includes(name)) {
            const updated = [...customPresets, name];
            setCustomPresets(updated);
            localStorage.setItem('sanitizePresets', JSON.stringify(updated));
        }
        appendLog(`[preset] saved: ${name}`);
        showToast(`Preset "${name}" saved`);
    };

    const loadPreset = (name: string) => {
        const defaults: Record<string, any> = {
            'Default': { silenceThresholdDb: -35, minSegmentMs: 800, mergeGapMs: 300, targetPeakDb: -1, fadeMs: 12 },
            'Aggressive': { silenceThresholdDb: -40, minSegmentMs: 600, mergeGapMs: 200, targetPeakDb: -2, fadeMs: 8 },
            'Broadcast': { silenceThresholdDb: -30, minSegmentMs: 1000, mergeGapMs: 400, targetPeakDb: 0, fadeMs: 15 },
        };
        const stored = localStorage.getItem(`sanitizePreset_${name}`);
        const preset = stored ? JSON.parse(stored) : defaults[name];
        if (preset) {
            setSilenceThresholdDb(preset.silenceThresholdDb);
            setMinSegmentMs(preset.minSegmentMs);
            setMergeGapMs(preset.mergeGapMs);
            setTargetPeakDb(preset.targetPeakDb);
            setFadeMs(preset.fadeMs);
            appendLog(`[preset] loaded: ${name}`);
        }
    };

    const deletePreset = (name: string) => {
        localStorage.removeItem(`sanitizePreset_${name}`);
        const updated = customPresets.filter((p) => p !== name);
        setCustomPresets(updated);
        localStorage.setItem('sanitizePresets', JSON.stringify(updated));
        appendLog(`[preset] deleted: ${name}`);
        showToast(`Preset "${name}" deleted`);
    };

    const runStep = (id: StepId) => {
        markRunning(id);
        setTimeout(() => {
            const outputs = id === 'audio'
                ? [{ label: 'Audio path', path: 'out/juggernaut/audio.wav' }]
                : id === 'sanitize'
                    ? [{ label: 'Clean path', path: 'out/juggernaut/audio.clean.wav' }]
                    : id === 'srt'
                        ? [{ label: 'SRT', path: 'out/juggernaut/subs.srt' }]
                        : id === 'tts'
                            ? [{ label: 'Voice file', path: 'out/juggernaut/tts.wav' }]
                            : undefined;
            markDone(id, outputs);
        }, 500);
    };

    const checkVod = async () => {
        if (!vodUrl.trim()) {
            setVodError('Enter a VOD URL to continue.');
            return;
        }
        setVodError(null);
        setVodMeta(null);
        setVodLoading(true);
        markRunning('vod');
        try {
            const meta = await api.checkVod(vodUrl.trim());
            setVodMeta(meta);
            markDone('vod');
            appendLog(`[vod] ${meta.streamer} · ${meta.title} (${meta.duration})`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Check failed';
            setVodError(message);
            markError('vod');
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
        const firstIncomplete = (['vod', 'audio', 'sanitize', 'srt', 'tts'] as StepId[]).find(
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

    const runSanitize = async () => {
        if (!vodMeta) {
            setVodError('Run VOD check first.');
            setActiveId('vod');
            return;
        }
        markRunning('sanitize');
        try {
            const res = await api.runSanitize({
                vodUrl: vodUrl.trim(),
                silenceThresholdDb,
                minSegmentMs,
                mergeGapMs,
                targetPeakDb,
                fadeMs,
            });
            setSanitizePreviewPath(res.previewPath);
            setSanitizeCleanPath(res.cleanPath ?? null);
            setSanitizePreviewRate(res.previewSampleRate);
            setSanitizeSegments(res.previewSegments || []);
            const outputs = [
                { label: 'Clean audio', path: res.cleanPath },
                { label: 'Segments JSON', path: res.segmentsPath },
            ];
            markDone('sanitize', outputs, `Segments: ${res.segments}`);
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
            setSrtExcerpt(res.excerpt);
            const outputs = [{ label: 'SRT file', path: res.path }];
            markDone('srt', outputs, `Lines: ${res.lines}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'SRT failed';
            markError('srt', message);
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
        markRunning('tts');
        try {
            const res = await api.runTts({ vodUrl: vodUrl.trim(), text: ttsText.trim(), streamer: ttsStreamer.trim() || 'streamer' });
            const outputs = [{ label: 'TTS audio', path: res.outputPath }];
            markDone('tts', outputs, 'TTS ready');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'TTS failed';
            markError('tts', message);
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
                    <DiffBanner message="Settings changed since last run." onRerun={checkVod} />
                    <PresetBar
                        label="Sanitize Preset"
                        presets={['Default', 'Aggressive', 'Broadcast', ...customPresets]}
                        value={sanitizePreset}
                        onChange={(name) => {
                            setSanitizePreset(name);
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
                {!vodMeta && <EmptyState title="VOD required" body="Complete VOD check before extracting audio." />}
                {activeStep.status === 'error' && <DiffBanner message={activeStep.message || 'Audio extraction failed.'} onRerun={runAudio} />}
                {activeStep.outputs && activeStep.outputs.map((o) => <PathRow key={o.path} label={o.label} path={o.path} onCopy={() => showToast('Copied path')} />)}
            </div>
        </div>
    );

    const renderSanitize = () => (
        <div className="space-y-3">
            <div className={shellClasses + ' p-4 space-y-3'}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-semibold text-slate-100">3. Sanitize</p>
                        <p className="text-sm text-slate-400">Trim silence, normalize, and preview.</p>
                    </div>
                    <button
                        className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60"
                        onClick={runSanitize}
                        disabled={!vodMeta || activeStep.status === 'running'}
                    >
                        {activeStep.status === 'running' ? 'Running...' : 'Run sanitize'}
                    </button>
                </div>
                <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />
                {activeStep.status === 'error' && (
                    <DiffBanner message={activeStep.message || 'Sanitize failed. Adjust settings and re-run.'} onRerun={runSanitize} />
                )}
                {activeStep.status !== 'error' && (
                    <DiffBanner message="Settings changed since last run." onRerun={runSanitize} />
                )}
                <button
                    className="text-xs px-3 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent"
                    onClick={() => setSanitizeDrawerOpen((v) => !v)}
                >
                    {sanitizeDrawerOpen ? 'Hide settings' : 'Show settings'}
                </button>
                {sanitizeDrawerOpen && (
                    <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
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
                <AudioPreviewCard
                    title="Preview"
                    durationSec={sanitizePreviewPath ? 42 : 0}
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
                        <p>Przeglądaj segmenty jak Tinder: Enter = akceptuj, Spacja = odrzuć. Po decyzji automatycznie odtwarzamy kolejny.</p>
                        <p className="text-slate-400 text-xs">W tle transkrypcja tylko dla zaakceptowanych. Tylko jeden odtwarzacz gra naraz.</p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="w-3 h-3 bg-emerald-500/70 inline-block rounded-sm" /> Zaakceptowane
                            <span className="w-3 h-3 bg-rose-500/70 inline-block rounded-sm" /> Odrzucone
                            <span className="w-3 h-3 bg-slate-700/70 inline-block rounded-sm" /> Nieocenione
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

    const renderTts = () => (
        <div className="space-y-3">
            <div className={shellClasses + ' p-4 space-y-3'}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-lg font-semibold text-slate-100">6. TTS</p>
                        <p className="text-sm text-slate-400">Synthesize voice.</p>
                    </div>
                    <button
                        className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60"
                        onClick={runTts}
                        disabled={!vodMeta || activeStep.status === 'running'}
                    >
                        {activeStep.status === 'running' ? 'Running...' : 'Run TTS'}
                    </button>
                </div>
                <StatusCard step={activeStep} onViewLogs={() => setConsoleCollapsed(false)} />
                <div className="space-y-3">
                    <div className="space-y-2">
                        <label className="text-sm text-slate-200">Streamer</label>
                        <input
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                            value={ttsStreamer}
                            onChange={(e) => setTtsStreamer(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-slate-200">TTS text</label>
                        <textarea
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                            rows={4}
                            value={ttsText}
                            onChange={(e) => setTtsText(e.target.value)}
                        />
                    </div>
                </div>
                {sanitizeSegments.length > 0 && (
                    <button
                        className="px-3 py-2 rounded-lg border border-slate-700 hover:border-accent hover:text-accent text-sm"
                        onClick={() => setShowVoiceLab(!showVoiceLab)}
                    >
                        {showVoiceLab ? 'Close Voice Lab' : 'Open Voice Lab'}
                    </button>
                )}
                {showVoiceLab && <VoiceLab vodUrl={vodUrl} onRun={runVoiceLab} onClose={() => setShowVoiceLab(false)} />}
                {activeStep.outputs ? (
                    <div className="space-y-2">
                        {activeStep.outputs.map((o) => <PathRow key={o.path} label={o.label} path={o.path} onCopy={() => showToast('Copied path')} />)}
                        {activeStep.status === 'done' && (
                            <DiffBanner message="Review voice output and apply." onRerun={runTts} />
                        )}
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
            case 'tts':
                return renderTts();
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-3 space-y-3">
                    <Sidebar steps={steps} activeId={activeId} onSelect={(id) => setActiveId(id as StepId)} />
                </div>
                <div className="col-span-12 md:col-span-6 space-y-3">
                    <MiniStepper steps={steps} activeId={activeId} onSelect={(id) => setActiveId(id as StepId)} />
                    {renderContent()}
                </div>
                <div className="col-span-12 md:col-span-3 h-[600px]">
                    <ConsolePanel
                        logs={logs}
                        collapsed={consoleCollapsed}
                        follow={followLogs}
                        onToggleCollapse={() => setConsoleCollapsed((v) => !v)}
                        onToggleFollow={() => setFollowLogs((v) => !v)}
                        onClear={() => setLogs([])}
                    />
                </div>
            </div>
            <div className="sticky bottom-0 w-full">
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
                            setSanitizePreset('Default');
                            loadPreset('Default');
                        }
                    }}
                />
            )}
        </div>
    );
}
