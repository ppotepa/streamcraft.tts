export type VodMeta = {
    streamer: string;
    title: string;
    duration: string;
    previewUrl: string;
    vodId: string;
    platform: 'twitch' | 'youtube';
};

export type AudioResult = { exitCode: number; path: string; log: string[] };
export type SegmentPreview = {
    start: number;
    end: number;
    duration: number;
    rmsDb?: number | null;
    quality?: number | null;
    speechRatio?: number | null;
    snrDb?: number | null;
    clipRatio?: number | null;
    sfxScore?: number | null;
    speakerSim?: number | null;
    kept?: boolean;
    labels?: string[];
    rejectReason?: string[];
};
export type SegmentReviewVote = { index: number; decision: 'accept' | 'reject'; segment: SegmentPreview };
export type SegmentReviewState = {
    reviewPath?: string | null;
    totalSegments: number;
    reviewIndex: number;
    accepted: number;
    rejected: number;
    updatedAt?: string | null;
    votes: SegmentReviewVote[];
};

export type ExportClipItem = { index: number; start: number; end: number; duration: number; path: string };
export type ExportClipsResponse = { clipsDir: string; sampleRate: number; count: number; items: ExportClipItem[] };
export type SanitizeResult = {
    exitCode: number;
    cleanPath: string;
    segmentsPath: string;
    segments: number;
    cleanDuration: number;
    previewSegments: SegmentPreview[];
    previewPath: string;
    previewSampleRate: number;
    appliedSettings: {
        mode: 'auto' | 'voice';
        preset: 'strict' | 'balanced' | 'lenient';
        strictness: number;
        params: Record<string, number>;
    };
    voiceSamples: { start: number; end: number; duration: number; rmsDb: number; path: string }[];
    log: string[];
};
export type SanitizeProgressEvent = { stage?: string; value?: number; message?: string; type?: string };
export type SrtResult = { exitCode: number; path: string; lines: number; excerpt: string; log: string[] };
export type TtsResult = { exitCode: number; outputPath: string; log: string[] };
export type TtsStreamResult = { exitCode: number; outputPath: string; log: string[] };
export type TrainResult = { exitCode: number; datasetPath: string; clipsDir: string; manifestPath: string; segmentsPath: string; log: string[] };

export type Job = {
    id: string;
    vodUrl: string;
    streamer: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    steps: {
        vod: boolean;
        sanitize: boolean;
        srt: boolean;
        tts: boolean;
        train?: boolean;
        review?: boolean;
        audio?: boolean; // legacy compatibility
    };
    outputs?: {
        audioPath?: string;
        sanitizePath?: string;
        srtPath?: string;
        ttsPath?: string;
    };
};

export interface WizardApi {
    checkVod: (url: string) => Promise<VodMeta>;
    runAudio: (opts: { vodUrl: string; force: boolean; useDemucs: boolean; skipAac: boolean; authToken?: string; vodQuality?: string }) => Promise<AudioResult>;
    runSanitize: (
        opts: {
            vodUrl: string;
            mode: 'auto' | 'voice';
            preset?: 'strict' | 'balanced' | 'lenient';
            strictness?: number;
            extractVocals?: boolean;
            uvrModel?: 'bs-roformer' | 'mdx-net' | 'demucs';
            uvrPrecision?: 'fp32' | 'fp16' | 'int8';
            preview?: boolean;
            previewStart?: number;
            previewDuration?: number;
            voiceSample?: boolean;
            voiceSampleCount?: number;
            voiceSampleMinDuration?: number;
            voiceSampleMaxDuration?: number;
            voiceSampleMinRmsDb?: number;
            manualSamples?: Array<{ start: number; end: number }>;
            preservePauses?: boolean;
            reduceSfx?: boolean;
            targetLufs?: number;
            truePeakLimitDb?: number;
            fadeMs?: number;
            stream?: boolean;
            onLog?: (line: string) => void;
            onProgress?: (evt: SanitizeProgressEvent) => void;
        }
    ) => Promise<SanitizeResult>;
    runSrt: (opts: { vodUrl: string }) => Promise<SrtResult>;
    runTrain: (opts: { vodUrl: string }) => Promise<TrainResult>;
    runTts: (opts: { vodUrl: string; text: string; streamer: string; onLog?: (line: string) => void }) => Promise<TtsStreamResult>;
    getSegmentReview: (opts: { vodUrl: string }) => Promise<SegmentReviewState>;
    saveSegmentReview: (
        opts: { vodUrl: string; totalSegments: number; reviewIndex: number; votes: SegmentReviewVote[] }
    ) => Promise<SegmentReviewState>;
    exportClips: (opts: { vodUrl: string }) => Promise<ExportClipsResponse>;
    artifactUrl: (path: string) => string;
    getJobs: () => Promise<Job[]>;
    getJob: (id: string) => Promise<Job>;
    updateJob: (id: string, updates: Partial<Job>) => Promise<Job>;
    deleteJob: (id: string) => Promise<void>;
}

const defaultBase = import.meta.env.VITE_API_BASE ?? 'http://localhost:8010/api';
const defaultUseMock = (import.meta.env.VITE_USE_MOCK ?? 'false').toLowerCase() !== 'false';

export function createApi(options?: { baseUrl?: string; useMock?: boolean; delayMs?: number }): WizardApi {
    const useMock = options?.useMock ?? defaultUseMock;
    const baseUrl = options?.baseUrl ?? defaultBase;
    if (useMock) return new MockApi(options?.delayMs ?? 500);
    return new HttpApi(baseUrl);
}

class HttpApi implements WizardApi {
    constructor(private readonly baseUrl: string) { }

    async checkVod(url: string): Promise<VodMeta> {
        const res = await fetch(`${this.baseUrl}/vod/check?vod_url=${encodeURIComponent(url)}`, {
            method: 'POST',
        });
        if (!res.ok) {
            const message = await res.text();
            throw new Error(message || `Request failed (${res.status})`);
        }
        return (await res.json()) as VodMeta;
    }

    async runAudio(opts: { vodUrl: string; force: boolean; useDemucs: boolean; skipAac: boolean; authToken?: string; vodQuality?: string }): Promise<AudioResult> {
        return this.post<AudioResult>('/audio/run', opts);
    }

    async runSanitize(opts: {
        vodUrl: string;
        mode: 'auto' | 'voice';
        preset?: 'strict' | 'balanced' | 'lenient';
        strictness?: number;
        extractVocals?: boolean;
        uvrModel?: 'bs-roformer' | 'mdx-net' | 'demucs';
        uvrPrecision?: 'fp32' | 'fp16' | 'int8';
        preview?: boolean;
        previewStart?: number;
        previewDuration?: number;
        voiceSample?: boolean;
        voiceSampleCount?: number;
        voiceSampleMinDuration?: number;
        voiceSampleMaxDuration?: number;
        voiceSampleMinRmsDb?: number;
        manualSamples?: Array<{ start: number; end: number }>;
        preservePauses?: boolean;
        reduceSfx?: boolean;
        targetLufs?: number;
        truePeakLimitDb?: number;
        fadeMs?: number;
        stream?: boolean;
        onLog?: (line: string) => void;
        onProgress?: (evt: SanitizeProgressEvent) => void;
    }): Promise<SanitizeResult> {
        if (opts.stream) {
            const body = { ...opts, stream: true };
            const res = await fetch(`${this.baseUrl}/sanitize/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const message = await res.text();
                throw new Error(message || `Request failed (${res.status})`);
            }

            const reader = res.body?.getReader();
            if (!reader) {
                throw new Error('Streaming not supported for sanitize');
            }

            const decoder = new TextDecoder('utf-8');
            let buffer = '';
            const log: string[] = [];
            let final: SanitizeResult | null = null;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                let idx;
                while ((idx = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, idx).trim();
                    buffer = buffer.slice(idx + 1);
                    if (!line) continue;

                    let evt: any = null;
                    try {
                        evt = JSON.parse(line);
                    } catch (err) {
                        // swallow malformed JSON lines
                        continue;
                    }

                    // Process event (errors should propagate)
                    if (evt.type === 'log' && evt.line) {
                        log.push(evt.line);
                        opts.onLog?.(evt.line);
                    } else if (evt.type === 'progress') {
                        opts.onProgress?.({ type: 'progress', stage: evt.stage, value: evt.value, message: evt.message });
                    } else if (evt.type === 'stage') {
                        opts.onProgress?.({ type: 'stage', stage: evt.stage, message: evt.message });
                    } else if (evt.type === 'done' && evt.result) {
                        final = evt.result as SanitizeResult;
                    } else if (evt.type === 'error') {
                        throw new Error(evt.error || 'Sanitize failed');
                    }
                }
            }

            if (!final) {
                const lastLogs = log.slice(-5).join('\n');
                const errorMsg = lastLogs
                    ? `Sanitize finished without result. Recent logs:\n${lastLogs}`
                    : 'Sanitize finished without result';
                throw new Error(errorMsg);
            }

            if (!final.log || final.log.length === 0) {
                final.log = log;
            }
            return final;
        }

        return this.post<SanitizeResult>('/sanitize/run', opts);
    }

    async runSrt(opts: { vodUrl: string }): Promise<SrtResult> {
        return this.post<SrtResult>('/srt/run', opts);
    }

    async runTrain(opts: { vodUrl: string }): Promise<TrainResult> {
        return this.post<TrainResult>('/train/run', opts);
    }

    async runTts(opts: { vodUrl: string; text: string; streamer: string; onLog?: (line: string) => void }): Promise<TtsStreamResult> {
        const body = { vodUrl: opts.vodUrl, text: opts.text, streamer: opts.streamer, stream: true };
        const res = await fetch(`${this.baseUrl}/tts/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || `Request failed (${res.status})`);
        }

        // Stream NDJSON logs
        const reader = res.body?.getReader();
        if (!reader) {
            throw new Error('Streaming not supported');
        }

        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        const log: string[] = [];
        let outputPath = '';
        let exitCode = 0;
        let idx = -1;

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            while ((idx = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, idx).trim();
                buffer = buffer.slice(idx + 1);
                if (!line) continue;
                try {
                    const evt = JSON.parse(line);
                    if (evt.type === 'log' && evt.line) {
                        log.push(evt.line);
                        opts.onLog?.(evt.line);
                    } else if (evt.type === 'done') {
                        exitCode = evt.exitCode ?? 0;
                        outputPath = evt.outputPath ?? '';
                    } else if (evt.type === 'error') {
                        throw new Error(evt.error || 'TTS failed');
                    }
                } catch (err) {
                    // swallow malformed lines
                }
            }
        }

        if (!outputPath) {
            throw new Error('TTS finished without outputPath');
        }

        return { exitCode, outputPath, log };
    }

    async getSegmentReview(opts: { vodUrl: string }): Promise<SegmentReviewState> {
        const params = new URLSearchParams({ vodUrl: opts.vodUrl });
        const res = await fetch(`${this.baseUrl}/sanitize/review?${params.toString()}`);
        if (!res.ok) {
            const message = await res.text();
            throw new Error(message || `Request failed (${res.status})`);
        }
        return (await res.json()) as SegmentReviewState;
    }

    async saveSegmentReview(opts: {
        vodUrl: string;
        totalSegments: number;
        reviewIndex: number;
        votes: SegmentReviewVote[];
    }): Promise<SegmentReviewState> {
        return this.post<SegmentReviewState>('/sanitize/review', opts);
    }

    async exportClips(opts: { vodUrl: string }): Promise<ExportClipsResponse> {
        return this.post<ExportClipsResponse>('/sanitize/export-clips', opts);
    }

    artifactUrl(path: string): string {
        return `${this.baseUrl}/artifact?path=${encodeURIComponent(path)}`;
    }

    async getJobs(): Promise<Job[]> {
        const res = await fetch(`${this.baseUrl}/jobs`);
        if (!res.ok) {
            const message = await res.text();
            throw new Error(message || `Request failed (${res.status})`);
        }
        return (await res.json()) as Job[];
    }

    async getJob(id: string): Promise<Job> {
        const res = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(id)}`);
        if (!res.ok) {
            const message = await res.text();
            throw new Error(message || `Request failed (${res.status})`);
        }
        return (await res.json()) as Job;
    }

    async updateJob(id: string, updates: Partial<Job>): Promise<Job> {
        const res = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        if (!res.ok) {
            const message = await res.text();
            throw new Error(message || `Request failed (${res.status})`);
        }
        return (await res.json()) as Job;
    }

    async deleteJob(id: string): Promise<void> {
        const res = await fetch(`${this.baseUrl}/jobs/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
        if (!res.ok) {
            const message = await res.text();
            throw new Error(message || `Request failed (${res.status})`);
        }
    }

    private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const message = await res.text();
            throw new Error(message || `Request failed (${res.status})`);
        }
        return (await res.json()) as T;
    }
}

class MockApi implements WizardApi {
    private reviewStore: Record<string, SegmentReviewState> = {};
    private jobStore: Job[] = [
        {
            id: 'job-1',
            vodUrl: 'https://www.twitch.tv/videos/2688036561',
            streamer: 'juggernautjason',
            title: 'Ranked grind night — finished audio',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            updatedAt: new Date(Date.now() - 1800000).toISOString(),
            steps: { vod: true, audio: true, sanitize: false, srt: false, tts: false },
            outputs: { audioPath: 'out/juggernautjason/audio/2688036561.wav' },
        },
        {
            id: 'job-2',
            vodUrl: 'https://www.twitch.tv/videos/2689875280',
            streamer: 'rotterdam08',
            title: 'Late night coding — sanitize done',
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            updatedAt: new Date(Date.now() - 3600000).toISOString(),
            steps: { vod: true, audio: true, sanitize: true, srt: false, tts: false },
            outputs: {
                audioPath: 'out/rotterdam08/audio/2689875280.wav',
                sanitizePath: 'out/rotterdam08/audio/2689875280.clean.wav',
            },
        },
    ];

    constructor(private readonly delayMs: number) { }

    async checkVod(url: string): Promise<VodMeta> {
        await sleep(this.delayMs);
        const vodId = extractVodId(url) || '2688036561';
        return {
            streamer: 'juggernautjason',
            title: 'Ranked grind night — vod mock',
            duration: '3:42:18',
            previewUrl: `https://static-cdn.jtvnw.net/previews-ttv/live_user_juggernautjason-320x180.jpg?vid=${vodId}`,
            vodId,
            platform: 'twitch',
        };
    }

    async runAudio(opts: { vodUrl: string; authToken?: string; vodQuality?: string }): Promise<AudioResult> {
        await sleep(this.delayMs);
        const vodId = extractVodId(opts.vodUrl) || '2688036561';
        return {
            exitCode: 0,
            path: `out/juggernautjason/audio/${vodId}.wav`,
            log: [
                `[i] downloading ${vodId}...`,
                '[i] muxing to wav',
                '[i] demucs: skipped (mock)',
                '[done] audio ready',
            ],
        };
    }

    async runSanitize(opts: {
        vodUrl: string;
        mode: 'auto' | 'voice';
        preset?: 'strict' | 'balanced' | 'lenient';
        strictness?: number;
        extractVocals?: boolean;
        uvrModel?: 'bs-roformer' | 'mdx-net' | 'demucs';
        uvrPrecision?: 'fp32' | 'fp16' | 'int8';
        preview?: boolean;
        previewStart?: number;
        previewDuration?: number;
        voiceSample?: boolean;
        voiceSampleCount?: number;
        voiceSampleMinDuration?: number;
        voiceSampleMaxDuration?: number;
        voiceSampleMinRmsDb?: number;
        manualSamples?: Array<{ start: number; end: number }>;
        preservePauses?: boolean;
        reduceSfx?: boolean;
        targetLufs?: number;
        truePeakLimitDb?: number;
        fadeMs?: number;
    }): Promise<SanitizeResult> {
        await sleep(this.delayMs);
        const vodId = extractVodId(opts.vodUrl) || '2688036561';
        const applied = {
            mode: opts.mode,
            preset: opts.preset || 'balanced',
            strictness: typeof opts.strictness === 'number' ? opts.strictness : 0.5,
            extractVocals: opts.extractVocals || false,
            uvrModel: opts.uvrModel || 'bs-roformer',
            uvrPrecision: opts.uvrPrecision || 'fp16',
            params: {
                speechProbThreshold: opts.preset === 'strict' ? 0.75 : opts.preset === 'lenient' ? 0.55 : 0.65,
                qualityMinScore: opts.preset === 'strict' ? 75 : opts.preset === 'lenient' ? 45 : 60,
                minSegmentMs: opts.preset === 'lenient' ? 450 : opts.preset === 'strict' ? 900 : 650,
                minSilenceMsToSplit: opts.preset === 'strict' ? 220 : opts.preset === 'lenient' ? 320 : 260,
                hangoverMs: opts.preset === 'strict' ? 220 : opts.preset === 'lenient' ? 180 : 200,
                preRollMs: 80,
                postRollMs: opts.preset === 'strict' ? 220 : 200,
                sfxPenaltyStrength: 1.0,
                frameKeep: 0.55,
            },
        };
        return {
            exitCode: 0,
            cleanPath: `out/juggernautjason/audio/${vodId}.clean.wav`,
            segmentsPath: `out/juggernautjason/audio/${vodId}.segments.json`,
            segments: 120,
            cleanDuration: 1800,
            previewSegments: [
                { start: 0, end: 4.2, duration: 4.2, rmsDb: -24, quality: 80, speechRatio: 0.9, snrDb: 18, clipRatio: 0.0, sfxScore: 0.1, speakerSim: 0.5, kept: true, labels: ['excellent'] },
                { start: 6.5, end: 14.1, duration: 7.6, rmsDb: -22, quality: 65, speechRatio: 0.7, snrDb: 12, clipRatio: 0.01, sfxScore: 0.2, speakerSim: 0.5, kept: true, labels: ['good'] },
            ],
            previewPath: `out/juggernautjason/audio/${vodId}.preview.wav`,
            previewSampleRate: 24000,
            appliedSettings: applied,
            voiceSamples: (opts.mode === 'voice' || opts.manualSamples)
                ? (opts.manualSamples || [
                    { start: 0, end: 5, duration: 5, rmsDb: -20, path: `out/juggernautjason/audio/${vodId}.voice_samples/sample0.wav` },
                    { start: 6, end: 11, duration: 5, rmsDb: -21, path: `out/juggernautjason/audio/${vodId}.voice_samples/sample1.wav` },
                ]).slice(0, 5).map((s: any, i: number) => ({
                    ...s,
                    duration: s.duration || (s.end - s.start),
                    rmsDb: s.rmsDb || -20,
                    path: s.path || `out/juggernautjason/audio/${vodId}.voice_samples/sample${i}.wav`,
                }))
                : [],
            log: [
                '[i] trimming silence',
                '[i] normalizing loudness',
                '[i] voice focus done',
                '[done] sanitized audio ready',
            ],
        };
    }

    async runSrt(opts: { vodUrl: string }): Promise<SrtResult> {
        await sleep(this.delayMs);
        const vodId = extractVodId(opts.vodUrl) || '2688036561';
        const excerpt = `1\n00:00:01,000 --> 00:00:04,000\nwelcome back chat, loading into ranked\n\n2\n00:00:05,000 --> 00:00:07,200\ngive me one second to set audio`; // newline escapes
        return {
            exitCode: 0,
            path: `out/juggernautjason/vods/${vodId}/${vodId}.srt`,
            lines: 2,
            excerpt,
            log: ['[i] transcribing', '[i] aligning', '[done] srt ready'],
        };
    }

    async runTrain(opts: { vodUrl: string }): Promise<TrainResult> {
        await sleep(this.delayMs);
        const vodId = extractVodId(opts.vodUrl) || '2688036561';
        return {
            exitCode: 0,
            datasetPath: `dataset/juggernautjason`,
            clipsDir: `dataset/juggernautjason/clips`,
            manifestPath: `dataset/juggernautjason/manifest.csv`,
            segmentsPath: `dataset/juggernautjason/segments.json`,
            log: ['[i] slicing clips', '[i] writing manifest', '[done] dataset ready'],
        };
    }

    async runTts(opts: { vodUrl: string; text: string; streamer: string; onLog?: (line: string) => void }): Promise<TtsStreamResult> {
        await sleep(this.delayMs);
        const log = [
            `[tts] starting for ${opts.streamer}`,
            '[tts] synthesizing... (mock)',
            '[done] tts ready',
        ];
        opts.onLog?.(log[0]);
        opts.onLog?.(log[1]);
        opts.onLog?.(log[2]);
        return {
            exitCode: 0,
            outputPath: `out/${opts.streamer}/tts/tts_${Date.now()}.wav`,
            log,
        };
    }

    async getSegmentReview(opts: { vodUrl: string }): Promise<SegmentReviewState> {
        await sleep(this.delayMs);
        return (
            this.reviewStore[opts.vodUrl] ?? {
                reviewPath: null,
                totalSegments: 0,
                reviewIndex: 0,
                accepted: 0,
                rejected: 0,
                updatedAt: null,
                votes: [],
            }
        );
    }

    async saveSegmentReview(opts: {
        vodUrl: string;
        totalSegments: number;
        reviewIndex: number;
        votes: SegmentReviewVote[];
    }): Promise<SegmentReviewState> {
        await sleep(this.delayMs);
        const accepted = opts.votes.filter((v) => v.decision === 'accept').length;
        const rejected = opts.votes.filter((v) => v.decision === 'reject').length;
        const state: SegmentReviewState = {
            reviewPath: `mock/review/${opts.vodUrl}.json`,
            totalSegments: opts.totalSegments,
            reviewIndex: opts.reviewIndex,
            accepted,
            rejected,
            updatedAt: new Date().toISOString(),
            votes: opts.votes,
        };
        this.reviewStore[opts.vodUrl] = state;
        return state;
    }

    async exportClips(opts: { vodUrl: string }): Promise<ExportClipsResponse> {
        await sleep(this.delayMs);
        const state = this.reviewStore[opts.vodUrl];
        const items = (state?.votes || [])
            .filter((v) => v.decision === 'accept')
            .map((v, i) => ({
                index: v.index,
                start: v.segment.start,
                end: v.segment.end,
                duration: v.segment.duration,
                path: `mock/clips/${opts.vodUrl}/keep_${i}.wav`,
            }));
        return { clipsDir: `mock/clips/${opts.vodUrl}`, sampleRate: 24000, count: items.length, items };
    }

    artifactUrl(): string {
        return '';
    }
    async getJobs(): Promise<Job[]> {
        await sleep(this.delayMs);
        return [...this.jobStore];
    }

    async getJob(id: string): Promise<Job> {
        await sleep(this.delayMs);
        const job = this.jobStore.find((j) => j.id === id);
        if (!job) throw new Error(`Job not found: ${id}`);
        return { ...job };
    }

    async updateJob(id: string, updates: Partial<Job>): Promise<Job> {
        await sleep(this.delayMs);
        const idx = this.jobStore.findIndex((j) => j.id === id);
        if (idx === -1) throw new Error(`Job not found: ${id}`);
        this.jobStore[idx] = { ...this.jobStore[idx], ...updates, updatedAt: new Date().toISOString() };
        return { ...this.jobStore[idx] };
    }

    async deleteJob(id: string): Promise<void> {
        await sleep(this.delayMs);
        const idx = this.jobStore.findIndex((j) => j.id === id);
        if (idx === -1) throw new Error(`Job not found: ${id}`);
        this.jobStore.splice(idx, 1);
    }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractVodId = (url: string) => {
    const m = /(?<id>\d+)/.exec(url ?? '');
    return m?.groups?.id ?? '';
};
