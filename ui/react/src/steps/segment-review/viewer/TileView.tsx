import React from 'react';

export type TileSegment = {
    index: number;
    duration: number;
};

export type TileVote = 'accept' | 'reject';

interface TileViewProps {
    segments: TileSegment[];
    playingIdx: number;
    currentIdx: number;
    votes: Record<number, TileVote>;
    onSelect: (idx: number) => void;
}

/**
 * Grid of colored tiles representing segments (Tinder-style view).
 */
export function TileView({ segments, playingIdx, currentIdx, votes, onSelect }: TileViewProps) {
    return (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(5px, 50px))', gap: '4px' }}>
            {segments.map((s, idx) => {
                const vote = votes[s.index];
                const isPlaying = idx === playingIdx;
                const isActive = idx === currentIdx;
                const base = !vote
                    ? 'bg-slate-800/80'
                    : vote === 'accept'
                        ? 'bg-emerald-500/80'
                        : 'bg-rose-500/80';
                const border = isPlaying
                    ? 'ring-2 ring-white shadow-[0_0_0_2px_rgba(255,255,255,0.35)]'
                    : isActive
                        ? 'ring-2 ring-accent/60'
                        : '';
                return (
                    <button
                        key={`tile-${s.index}-${idx}`}
                        className={`aspect-square rounded-sm ${base} ${border} transition hover:brightness-110`}
                        title={`#${s.index} · ${s.duration.toFixed(2)}s`}
                        onClick={() => onSelect(idx)}
                    />
                );
            })}
        </div>
    );
}
