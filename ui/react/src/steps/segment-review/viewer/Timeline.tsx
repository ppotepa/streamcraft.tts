import React from 'react';

export interface TimelineSegment {
    index: number;
    start: number;
    end: number;
    duration: number;
}

export type TimelineVote = 'accept' | 'reject';

interface TimelineProps {
    segments: TimelineSegment[];
    playingIdx: number;
    currentIdx: number;
    votes: Record<number, TimelineVote>;
    onSelect: (idx: number) => void;
}

/**
 * Timeline bar showing all segments with color-coded vote states.
 * Click segments to jump to them.
 */
export function Timeline({ segments, playingIdx, currentIdx, votes, onSelect }: TimelineProps) {
    const totalDuration = segments.length ? Math.max(...segments.map((s) => s.end)) : 0;

    return (
        <div className="relative w-full h-24 rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="absolute inset-x-4 inset-y-3">
                {segments.map((s, idx) => {
                    const vote = votes[s.index];
                    const color = !vote
                        ? 'bg-slate-700/70 border-slate-600'
                        : vote === 'accept'
                            ? 'bg-emerald-500/80 border-emerald-400'
                            : 'bg-rose-500/80 border-rose-400';
                    const startPct = (s.start / (totalDuration || 1)) * 100;
                    const widthPct = (s.duration / (totalDuration || 1)) * 100;
                    const isPlaying = idx === playingIdx;
                    const isActive = idx === currentIdx;

                    return (
                        <button
                            key={`timeline-${s.index}-${idx}`}
                            className={`absolute top-0 h-full border-2 ${color} ${isPlaying
                                ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 shadow-[0_0_0_2px_rgba(255,255,255,0.35)]'
                                : isActive
                                    ? 'ring-2 ring-accent/60'
                                    : ''
                                } hover:brightness-110 transition`}
                            style={{ left: `${startPct}%`, width: `${Math.max(widthPct, 0.2)}%` }}
                            onClick={() => onSelect(idx)}
                            title={`#${s.index} ${s.start.toFixed(2)}s-${s.end.toFixed(2)}s`}
                        />
                    );
                })}
            </div>
            <div className="absolute left-4 right-4 bottom-1 flex justify-between text-[10px] text-slate-400">
                <span>0s</span>
                <span>{totalDuration.toFixed(1)}s</span>
            </div>
        </div>
    );
}
