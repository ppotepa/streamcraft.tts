export type VodMeta = {
    streamer: string;
    title: string;
    duration: string;
    previewUrl: string;
    vodId: string;
};

export type AudioResult = { exitCode: number; path: string; log: string[] };
export type SanitizeResult = { exitCode: number; cleanPath: string; segmentsPath: string; log: string[] };
export type SrtResult = { exitCode: number; path: string; lines: number; excerpt: string; log: string[] };
export type TtsResult = { exitCode: number; outputPath: string; log: string[] };

export interface WizardApi {
    checkVod: (url: string) => Promise<VodMeta>;
    runAudio: (opts: { vodUrl: string; force: boolean; useDemucs: boolean; skipAac: boolean }) => Promise<AudioResult>;
    runSanitize: (opts: { vodUrl: string }) => Promise<SanitizeResult>;
    runSrt: (opts: { vodUrl: string }) => Promise<SrtResult>;
    runTts: (opts: { vodUrl: string; text: string; streamer: string }) => Promise<TtsResult>;
}

const defaultBase = import.meta.env.VITE_API_BASE ?? '/api';
const defaultUseMock = (import.meta.env.VITE_USE_MOCK ?? 'true').toLowerCase() !== 'false';

export function createApi(options?: { baseUrl?: string; useMock?: boolean; delayMs?: number }): WizardApi {
    const useMock = options?.useMock ?? defaultUseMock;
    const baseUrl = options?.baseUrl ?? defaultBase;
    if (useMock) return new MockApi(options?.delayMs ?? 500);
    return new HttpApi(baseUrl);
}

class HttpApi implements WizardApi {
    constructor(private readonly baseUrl: string) { }

    async checkVod(url: string): Promise<VodMeta> {
        return this.post<VodMeta>('/vod/check', { url });
    }

    async runAudio(opts: { vodUrl: string; force: boolean; useDemucs: boolean; skipAac: boolean }): Promise<AudioResult> {
        return this.post<AudioResult>('/audio/extract', opts);
    }

    async runSanitize(opts: { vodUrl: string }): Promise<SanitizeResult> {
        return this.post<SanitizeResult>('/audio/sanitize', opts);
    }

    async runSrt(opts: { vodUrl: string }): Promise<SrtResult> {
        return this.post<SrtResult>('/srt/extract', opts);
    }

    async runTts(opts: { vodUrl: string; text: string; streamer: string }): Promise<TtsResult> {
        return this.post<TtsResult>('/tts/generate', opts);
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

    async runSanitize(opts: { vodUrl: string }): Promise<SanitizeResult> {
        await sleep(this.delayMs);
        const vodId = extractVodId(opts.vodUrl) || '2688036561';
        return {
            exitCode: 0,
            cleanPath: `out/juggernautjason/audio/${vodId}.clean.wav`,
            segmentsPath: `out/juggernautjason/audio/${vodId}.segments.json`,
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
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractVodId = (url: string) => {
    const m = /(?<id>\d+)/.exec(url ?? '');
    return m?.groups?.id ?? '';
};
