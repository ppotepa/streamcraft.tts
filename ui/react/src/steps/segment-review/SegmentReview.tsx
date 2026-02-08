import React, { useEffect, useMemo, useState } from 'react';
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
    onClose: () => void;
    onSave: (accepted: number[], rejected: number[]) => void;
}

type Vote = 'accept' | 'reject';
type ReviewSegment = Segment & { index: number; duration: number };

/**
 * Main step component for segment review workflow.
 * Tinder-style single-player flow: normalize segments, vote, transcript accepted ones.
 */
export function SegmentReview({ segments, vodUrl, audioSrc, onClose, onSave }: SegmentReviewProps) {
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

    const current = normalizedSegments[currentIdx];
    const acceptedCount = Object.values(votes).filter((v) => v === 'accept').length;
    const rejectedCount = Object.values(votes).filter((v) => v === 'reject').length;

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
                    votes={votes}
                    transcripts={transcripts}
                    audioSrc={audioSrc}
                    playToken={playToken}
                    current={current}
                    onSelect={jumpTo}
                    onAccept={handleAccept}
                    onReject={handleReject}
                />
                <AcceptedList
                    segments={acceptedSegments}
                    transcripts={transcripts}
                    playingIndex={normalizedSegments[playingIdx]?.index}
                    onJumpTo={handleJumpToSegment}
                    onTranscriptChange={handleTranscriptChange}
                />
            </div>
        </div>
    );
}
