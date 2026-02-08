export type VodMeta = {
    streamer: string;
    title: string;
    duration: string;
    previewUrl: string;
    vodId: string;
};

export type AudioResult = { exitCode: number; path: string; log: string[] };
export type SegmentPreview = { start: number; end: number; duration: number; rmsDb: number };
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
    log: string[];
};
export type SrtResult = { exitCode: number; path: string; lines: number; excerpt: string; log: string[] };
export type TtsResult = { exitCode: number; outputPath: string; log: string[] };

export interface WizardApi {
    checkVod: (url: string) => Promise<VodMeta>;
    runAudio: (opts: { vodUrl: string; force: boolean; useDemucs: boolean; skipAac: boolean }) => Promise<AudioResult>;
    runSanitize: (
        opts: {
            vodUrl: string;
            silenceThresholdDb: number;
            minSegmentMs: number;
            mergeGapMs: number;
            targetPeakDb: number;
            fadeMs: number;
        }
    ) => Promise<SanitizeResult>;
    runSrt: (opts: { vodUrl: string }) => Promise<SrtResult>;
    runTts: (opts: { vodUrl: string; text: string; streamer: string }) => Promise<TtsResult>;
    getSegmentReview: (opts: { vodUrl: string }) => Promise<SegmentReviewState>;
    saveSegmentReview: (
        opts: { vodUrl: string; totalSegments: number; reviewIndex: number; votes: SegmentReviewVote[] }
    ) => Promise<SegmentReviewState>;
    exportClips: (opts: { vodUrl: string }) => Promise<ExportClipsResponse>;
    artifactUrl: (path: string) => string;
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

    async runAudio(opts: { vodUrl: string; force: boolean; useDemucs: boolean; skipAac: boolean }): Promise<AudioResult> {
        return this.post<AudioResult>('/audio/run', opts);
    }

    async runSanitize(opts: {
        vodUrl: string;
        silenceThresholdDb: number;
        minSegmentMs: number;
        mergeGapMs: number;
        targetPeakDb: number;
        fadeMs: number;
    }): Promise<SanitizeResult> {
        return this.post<SanitizeResult>('/sanitize/run', opts);
    }

    async runSrt(opts: { vodUrl: string }): Promise<SrtResult> {
        return this.post<SrtResult>('/srt/run', opts);
    }

    async runTts(opts: { vodUrl: string; text: string; streamer: string }): Promise<TtsResult> {
        return this.post<TtsResult>('/tts/run', opts);
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
        };
    }

    async runAudio(opts: { vodUrl: string }): Promise<AudioResult> {
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
        silenceThresholdDb: number;
        minSegmentMs: number;
        mergeGapMs: number;
        targetPeakDb: number;
        fadeMs: number;
    }): Promise<SanitizeResult> {
        await sleep(this.delayMs);
        const vodId = extractVodId(opts.vodUrl) || '2688036561';
        return {
            exitCode: 0,
            cleanPath: `out/juggernautjason/audio/${vodId}.clean.wav`,
            segmentsPath: `out/juggernautjason/audio/${vodId}.segments.json`,
            segments: 120,
            cleanDuration: 1800,
            previewSegments: [
                { start: 0, end: 4.2, duration: 4.2, rmsDb: -24 },
                { start: 6.5, end: 14.1, duration: 7.6, rmsDb: -22 },
            ],
            previewPath: `out/juggernautjason/audio/${vodId}.preview.wav`,
            previewSampleRate: 24000,
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

    async runTts(opts: { vodUrl: string; text: string; streamer: string }): Promise<TtsResult> {
        await sleep(this.delayMs);
        return {
            exitCode: 0,
            outputPath: `out/${opts.streamer}/tts/tts_${Date.now()}.wav`,
            log: ['[i] xtts_v2', '[i] vocoder', '[done] file written'],
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
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractVodId = (url: string) => {
    const m = /(?<id>\d+)/.exec(url ?? '');
    return m?.groups?.id ?? '';
};
