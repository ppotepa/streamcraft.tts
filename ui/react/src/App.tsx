import { useRef, useState } from 'react';
import { createApi, VodMeta, WizardApi } from './api/client';

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

const cardShell = 'rounded-2xl border border-white/10 bg-panel/80 backdrop-blur-sm shadow-panel';
const softCard = 'rounded-xl border border-white/5 bg-panel/70';
const primaryButton = 'px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold text-sm shadow-md shadow-accent/30 transition hover:-translate-y-0.5 hover:bg-accentSoft disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0';
const ghostButton = 'px-4 py-2 rounded-lg border border-white/10 text-sm text-slate-100 transition hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed';

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
    const [showLogs, setShowLogs] = useState(false);
    const [srtExcerpt, setSrtExcerpt] = useState('');
    const [ttsText, setTtsText] = useState('Thanks for hanging out, chat. See you next stream!');

    const setFlowState = (id: StepId, patch: Partial<StepState>) => {
        setFlow((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    };

    const appendLog = (entry: string) => setLogs((prev) => [...prev, entry]);
    const appendLogs = (entries: string[]) => setLogs((prev) => [...prev, ...entries]);

    const vodReady = flow.vod.status === 'done' && !!flow.vod.ready;
    const audioReady = flow.audio.status === 'done' && !!flow.audio.ready;
    const sanitizeReady = flow.sanitize.status === 'done' && !!flow.sanitize.ready;
    const srtReady = flow.srt.status === 'done' && !!flow.srt.ready;

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
            const res = await apiRef.current.runSanitize({ vodUrl });
            setPaths((prev) => ({ ...prev, clean: res.cleanPath, segments: res.segmentsPath }));
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

    return (
        <div className="relative min-h-screen bg-surface text-slate-100 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(248,113,113,0.12),transparent_26%),radial-gradient(circle_at_80%_75%,rgba(14,165,233,0.12),transparent_30%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(120deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:140px_140px]" />
            <div className="relative max-w-6xl mx-auto px-5 py-8 grid grid-rows-[auto,1fr] gap-6">
                <header className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] uppercase tracking-[0.16em] text-accent">
                            Tailwind flow
                        </div>
                        <h1 className="text-3xl font-semibold leading-tight">Streamcraft Wizard</h1>
                        <p className="text-sm text-slate-300">VOD → Audio → Sanitization → SRT → TTS</p>
                    </div>
                    <button className={ghostButton} onClick={() => setShowLogs(true)}>
                        View logs
                    </button>
                </header>

                <div className="grid grid-cols-[260px,1fr] gap-5 min-h-0 max-lg:grid-cols-1">
                    <aside className={`${cardShell} p-4`}>
                        <div className="flex flex-col gap-1 mb-3">
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
                                            <div className="text-xs text-slate-400 truncate">{unlocked ? s.sub : 'Locked: finish previous step'}</div>
                                        </div>
                                        {statusTag(state) && (
                                            <span
                                                className={`text-[11px] px-2 py-1 rounded-full border ${state.status === 'running'
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
                    </aside>

                    <main className="flex flex-col gap-4 pb-8 min-h-0">
                        <section className={`${softCard} p-4 flex flex-col gap-3 border border-white/10`}>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Wizard</div>
                                    <h2 className="text-lg font-semibold">{steps[stepIndex]?.title} ({stepIndex + 1} of {steps.length})</h2>
                                </div>
                                <div className="flex items-center gap-2 text-xs flex-wrap justify-end">
                                    {steps.map((s, idx) => {
                                        const unlocked = isStepUnlocked(s.id);
                                        const active = s.id === step;
                                        return (
                                            <div
                                                key={s.id}
                                                className={`px-3 py-1 rounded-full border transition ${active
                                                    ? 'border-accent text-accent bg-white/5 shadow-accent/25'
                                                    : unlocked
                                                        ? 'border-white/10 text-slate-200'
                                                        : 'border-white/5 text-slate-500'
                                                    }`}
                                            >
                                                {idx + 1}. {s.title}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="absolute inset-0 bg-accent" style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }} />
                            </div>
                            <div className="flex items-center justify-between gap-2 text-sm">
                                <button className={ghostButton} onClick={goPrev} disabled={stepIndex === 0}>
                                    ← Previous
                                </button>
                                <span className="text-slate-400">Complete each step to unlock the next.</span>
                                <button
                                    className={primaryButton}
                                    onClick={goNext}
                                    disabled={stepIndex === steps.length - 1 || !nextUnlocked}
                                >
                                    Next →
                                </button>
                            </div>
                        </section>

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
                                                Demucs
                                            </label>
                                            <label className="inline-flex items-center gap-2">
                                                <input type="checkbox" checked={flags.skipAac} onChange={(e) => setFlags({ ...flags, skipAac: e.target.checked })} />
                                                Skip AAC
                                            </label>
                                        </div>
                                        <div className="flex gap-2">
                                            <button className={primaryButton} onClick={runVodCheck} disabled={!vodUrl}>
                                                Check VOD
                                            </button>
                                            <button className={ghostButton} onClick={goNext} disabled={!vodReady}>
                                                Next
                                            </button>
                                        </div>
                                        <div className={`${softCard} p-3`}>
                                            <div className="font-semibold text-sm">Status: {flow.vod.message ?? 'Waiting'}</div>
                                            <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                                                <div className="absolute inset-0 bg-accent" style={{ width: progressWidth(flow.vod) }} />
                                            </div>
                                            {vodMeta && (
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm mt-2">
                                                    <div>
                                                        <div className="text-slate-400 text-xs">Streamer</div>
                                                        <div>{vodMeta.streamer}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-400 text-xs">Title</div>
                                                        <div className="truncate">{vodMeta.title}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-400 text-xs">Duration</div>
                                                        <div>{vodMeta.duration}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-xs text-slate-400">Pinned preview</div>
                                        <div className={`${softCard} p-2 text-center`}>
                                            <img src={activeThumb} alt="VOD preview" className="w-full rounded-md border border-white/5" />
                                            <div className="text-xs text-slate-400 mt-2">{vodReady ? 'Loaded from Twitch' : 'Loads after metadata'}</div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {step === 'audio' && (
                            <section className={`${cardShell} p-5`}>
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Step 2</div>
                                        <h2 className="text-xl font-semibold">Audio extraction</h2>
                                    </div>
                                    <span className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-200">wav</span>
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
                        )}

                        {step === 'sanitize' && (
                            <section className={`${cardShell} p-5`}>
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Step 3</div>
                                        <h2 className="text-xl font-semibold">Audio sanitization</h2>
                                    </div>
                                    <span className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-200">clean wav + manifest</span>
                                </div>
                                <div className="grid lg:grid-cols-[2fr,1fr] gap-4">
                                    <div className="space-y-3">
                                        <div className={`${softCard} p-3`}>
                                            <div className="font-semibold text-sm">Status: {flow.sanitize.message ?? 'Waiting'}</div>
                                            <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                                                <div className="absolute inset-0 bg-accent" style={{ width: progressWidth(flow.sanitize) }} />
                                            </div>
                                            <div className="text-xs text-slate-400">Tasks: trim silence • normalize • voice focus</div>
                                            {paths.clean && <div className="text-sm mt-1">Clean: {paths.clean}</div>}
                                            {paths.segments && <div className="text-sm">Segments: {paths.segments}</div>}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs">
                                            <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5">Exit: {flow.sanitize.exitCode ?? '—'}</span>
                                            {sanitizeReady && <span className="px-2 py-1 rounded-full border border-green-500 text-green-200">ready</span>}
                                        </div>
                                        <div className="flex gap-2">
                                            <button className={primaryButton} onClick={runSanitize} disabled={!audioReady}>
                                                Run sanitization
                                            </button>
                                            <button className={ghostButton} onClick={goNext} disabled={!sanitizeReady}>
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-xs text-slate-400">Waveform</div>
                                        <div className="border border-dashed border-white/10 rounded-lg p-4 text-center text-sm text-slate-400">
                                            Waveform preview placeholder
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {step === 'srt' && (
                            <section className={`${cardShell} p-5`}>
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Step 4</div>
                                        <h2 className="text-xl font-semibold">SRT / text extraction</h2>
                                    </div>
                                    <span className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-200">srt</span>
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
                        )}

                        {step === 'tts' && (
                            <section className={`${cardShell} p-5`}>
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div>
                                        <div className="text-xs uppercase tracking-[0.08em] text-slate-400">Step 5</div>
                                        <h2 className="text-xl font-semibold">TTS</h2>
                                    </div>
                                    <span className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-200">xtts_v2</span>
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
                        )}
                    </main>
                </div>
            </div>
            {showLogs && (
                <div className="fixed inset-0 bg-black/70 grid place-items-center z-20" role="dialog" aria-modal>
                    <div className={`${cardShell} w-[min(900px,92vw)] p-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold">Logs</h3>
                            <button className={ghostButton} onClick={() => setShowLogs(false)}>
                                Close
                            </button>
                        </div>
                        <pre className="bg-surface border border-white/10 rounded-lg p-3 text-sm max-h-[420px] overflow-auto whitespace-pre-wrap font-mono">{logs.join('\n')}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
