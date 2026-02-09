import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from '../../shared/utils';
import { SegmentViewer } from './viewer';
import { AcceptedList, TranscriptJob } from './sidebar';

interface Segment {
    index?: number;
    start: number;
    end: number;
    duration?: number;
    rmsDb?: number;
    label?: string;
}

export interface SegmentReviewProps {
    segments: Segment[];
    vodUrl: string;
    audioSrc?: string;
    audioPath?: string;
    onClose: () => void;
    onSave: (accepted: number[], rejected: number[]) => void;
}

type Vote = 'accept' | 'reject';
type ReviewSegment = Segment & { index: number; duration: number };

/**
 * Main step component for segment review workflow.
 * Tinder-style single-player flow: normalize segments, vote, transcript accepted ones.
 */
export function SegmentReview({ segments, vodUrl, audioSrc, audioPath, onClose, onSave }: SegmentReviewProps) {
    // Normalize: every segment gets stable index and duration
    const normalizedSegments = useMemo<ReviewSegment[]>(
        () =>
            (segments || []).map((s, i) => ({
                ...s,
                index: s.index ?? i,
                duration: s.duration ?? Math.max(0, (s.end ?? 0) - (s.start ?? 0)),
            })),
        [segments]
    );

    const [currentIdx, setCurrentIdx] = useState(0);
    const [playingIdx, setPlayingIdx] = useState(0);
    const [votes, setVotes] = useState<Record<number, Vote>>({});
    const [transcripts, setTranscripts] = useState<Record<number, TranscriptJob>>({});
    const [playToken, setPlayToken] = useState(0);
    const [autopilotMode, setAutopilotMode] = useState(false);
    const [audioLoading, setAudioLoading] = useState(false);
    const [audioLoadingPct, setAudioLoadingPct] = useState<number | null>(null);
    const [audioSizeBytes, setAudioSizeBytes] = useState<number | null>(null);
    const audioLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const current = normalizedSegments[currentIdx];
    const acceptedCount = Object.values(votes).filter((v) => v === 'accept').length;
    const rejectedCount = Object.values(votes).filter((v) => v === 'reject').length;

    const audioFileName = useMemo(() => {
        if (!audioPath) return 'unknown';
        const parts = audioPath.split(/[/\\]/);
        return parts[parts.length - 1] || audioPath;
    }, [audioPath]);

    const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

    // Reset state when segments change
    useEffect(() => {
        setCurrentIdx(0);
        setPlayingIdx(0);
        setVotes({});
        setTranscripts({});
        if (normalizedSegments.length > 0) {
            setPlayToken((p) => p + 1);
        }
    }, [normalizedSegments]);

    const jumpTo = (idx: number) => {
        if (normalizedSegments.length === 0) return;
        const clamped = Math.min(Math.max(idx, 0), normalizedSegments.length - 1);
        setCurrentIdx(clamped);
        setPlayingIdx(clamped);
        setPlayToken((p) => p + 1);
    };

    const startTranscriptJob = (idx: number) => {
        if (transcripts[idx]) return;
        setTranscripts((t) => ({ ...t, [idx]: { state: 'pending' } }));
        setTimeout(() => {
            setTranscripts((t) => ({
                ...t,
                [idx]: { state: 'done', text: `Sample transcript for segment ${idx + 1} (auto)` },
            }));
        }, 800 + Math.random() * 1200);
    };

    const handleAccept = () => {
        if (!current) return;
        setVotes((v) => ({ ...v, [current.index]: 'accept' }));
        startTranscriptJob(current.index);
        if (autopilotMode && currentIdx < normalizedSegments.length - 1) {
            jumpTo(currentIdx + 1);
        }
    };

    const handleReject = () => {
        if (!current) return;
        setVotes((v) => ({ ...v, [current.index]: 'reject' }));
        setTranscripts((t) => {
            const next = { ...t };
            delete next[current.index];
            return next;
        });
        if (autopilotMode && currentIdx < normalizedSegments.length - 1) {
            jumpTo(currentIdx + 1);
        }
    };

    const handleSave = () => {
        const acceptedIds = normalizedSegments.filter((s) => votes[s.index] === 'accept').map((s) => s.index);
        const rejectedIds = normalizedSegments.filter((s) => votes[s.index] === 'reject').map((s) => s.index);
        onSave(acceptedIds, rejectedIds);
    };

    const handleJumpToSegment = (segmentIndex: number) => {
        const idx = normalizedSegments.findIndex((s) => s.index === segmentIndex);
        if (idx >= 0) jumpTo(idx);
    };

    const handleTranscriptChange = (segmentIndex: number, text: string) => {
        setTranscripts((t) => ({
            ...t,
            [segmentIndex]: { state: 'done', text },
        }));
    };

    // Fetch audio size once per audioSrc to display MB progress; try HEAD then Range fallback
    useEffect(() => {
        setAudioSizeBytes(null);
        if (!audioSrc) return;
        const controller = new AbortController();
        let settled = false;

        const parseSize = (resp: Response) => {
            const len = resp.headers.get('content-length');
            if (len) {
                const parsed = Number(len);
                if (Number.isFinite(parsed) && parsed > 0) {
                    setAudioSizeBytes(parsed);
                    settled = true;
                }
            }
            if (!settled) {
                const range = resp.headers.get('content-range');
                if (range) {
                    const match = range.match(/\/(\d+)$/);
                    if (match && match[1]) {
                        const parsed = Number(match[1]);
                        if (Number.isFinite(parsed) && parsed > 0) {
                            setAudioSizeBytes(parsed);
                            settled = true;
                        }
                    }
                }
            }
        };

        const tryRange = () =>
            fetch(audioSrc, {
                method: 'GET',
                headers: { Range: 'bytes=0-0' },
                signal: controller.signal,
            })
                .then((resp) => {
                    if (controller.signal.aborted) return;
                    parseSize(resp);
                })
                .catch((err) => {
                    if (controller.signal.aborted) return;
                    if ((err as any)?.name === 'AbortError') return;
                    console.debug('Audio size range fetch failed', err);
                });

        fetch(audioSrc, { method: 'HEAD', signal: controller.signal })
            .then((resp) => {
                if (controller.signal.aborted) return;
                parseSize(resp);
                if (!settled) {
                    return tryRange();
                }
                return undefined;
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                if ((err as any)?.name === 'AbortError') return;
                console.debug('Audio size HEAD failed', err);
                tryRange();
            });

        return () => {
            controller.abort();
        };
    }, [audioSrc]);

    // Keyboard shortcuts
    useHotkeys({
        Escape: (e) => {
            e.preventDefault();
            onClose();
        },
        ArrowUp: (e) => {
            e.preventDefault();
            jumpTo(currentIdx - 1);
        },
        ArrowDown: (e) => {
            e.preventDefault();
            jumpTo(currentIdx + 1);
        },
        Enter: (e) => {
            e.preventDefault();
            handleAccept();
        },
        Space: (e) => {
            e.preventDefault();
            handleReject();
        },
    });

    const acceptedSegments = normalizedSegments.filter((s) => votes[s.index] === 'accept');

    if (!current) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
                <div>
                    <h2 className="text-lg font-semibold text-slate-100">Segment Review</h2>
                    <p className="text-xs text-slate-400">
                        {currentIdx + 1} / {normalizedSegments.length} · Accepted {acceptedCount} · Rejected{' '}
                        {rejectedCount}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">Audio file: {audioFileName}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-1 text-xs text-slate-400">
                        <span className="w-3 h-3 bg-emerald-500/70 inline-block rounded-sm" /> Accepted
                        <span className="w-3 h-3 bg-rose-500/70 inline-block rounded-sm" /> Rejected
                        <span className="w-3 h-3 bg-slate-700/70 inline-block rounded-sm" /> Pending
                    </div>
                    <button
                        className={`px-3 py-1.5 rounded border text-xs font-semibold transition ${autopilotMode
                            ? 'border-accent bg-accent/20 text-accent shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                            : 'border-slate-700 text-slate-300 hover:border-accent hover:text-accent'
                            }`}
                        onClick={() => setAutopilotMode(!autopilotMode)}
                        title="Auto-advance to next segment after Accept/Reject"
                    >
                        {autopilotMode ? '⚡ AUTOPILOT ON' : 'AUTOPILOT MODE'}
                    </button>
                    <button
                        className="px-3 py-1 rounded border border-slate-700 text-xs hover:border-accent hover:text-accent"
                        onClick={handleSave}
                    >
                        Save
                    </button>
                    <button
                        className="px-3 py-1 rounded border border-slate-700 text-xs hover:border-accent hover:text-accent"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 overflow-hidden">
                <SegmentViewer
                    segments={normalizedSegments}
                    playingIdx={playingIdx}
                    currentIdx={currentIdx}
                    votes={votes}
                    transcripts={transcripts}
                    audioSrc={audioSrc}
                    playToken={playToken}
                    current={current}
                    onSelect={jumpTo}
                    onAccept={handleAccept}
                    onReject={handleReject}
                    onAudioLoading={(pct) => {
                        setAudioLoading(true);
                        setAudioLoadingPct(pct ?? 0);
                        if (audioLoadingTimerRef.current) {
                            clearTimeout(audioLoadingTimerRef.current);
                        }
                        // Fallback: auto-hide after 20s if ready/error not fired (network aborts etc.)
                        audioLoadingTimerRef.current = setTimeout(() => {
                            setAudioLoading(false);
                            setAudioLoadingPct(null);
                        }, 20000);
                    }}
                    onAudioReady={() => {
                        setAudioLoading(false);
                        setAudioLoadingPct(null);
                        if (audioLoadingTimerRef.current) {
                            clearTimeout(audioLoadingTimerRef.current);
                            audioLoadingTimerRef.current = null;
                        }
                    }}
                    onAudioError={() => {
                        setAudioLoading(false);
                        setAudioLoadingPct(null);
                        if (audioLoadingTimerRef.current) {
                            clearTimeout(audioLoadingTimerRef.current);
                            audioLoadingTimerRef.current = null;
                        }
                    }}
                />
                <AcceptedList
                    segments={acceptedSegments}
                    transcripts={transcripts}
                    playingIndex={normalizedSegments[playingIdx]?.index}
                    onJumpTo={handleJumpToSegment}
                    onTranscriptChange={handleTranscriptChange}
                />
            </div>

            {audioLoading && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="w-[320px] rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 text-sm text-slate-200 shadow-xl">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            <span>Ładowanie audio…</span>
                        </div>
                        <div className="text-xs text-slate-400">Duży plik może chwilę potrwać. Nie zamykaj okna.</div>
                        {audioLoadingPct !== null && (
                            <div className="space-y-1">
                                <div className="h-2 w-full rounded bg-slate-800 overflow-hidden">
                                    <div
                                        className="h-full bg-accent transition-all"
                                        style={{ width: `${Math.max(0, Math.min(100, audioLoadingPct))}%` }}
                                    />
                                </div>
                                <div className="text-[11px] text-slate-400">
                                    Postęp: {audioLoadingPct.toFixed(0)}%
                                    {audioSizeBytes && audioSizeBytes > 0 && (
                                        <>
                                            {' '}
                                            · {formatMb((audioLoadingPct / 100) * audioSizeBytes)} MB z {formatMb(audioSizeBytes)} MB
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
