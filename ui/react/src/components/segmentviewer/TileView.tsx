import React from 'react';

export type TileSegment = {
    index: number;
    duration: number;
};

export type TileVote = 'accept' | 'reject';

interface TileViewProps {
    segments: TileSegment[];
    playingIdx: number;
    votes: Record<number, TileVote>;
    onSelect: (idx: number) => void;
}

export function TileView({ segments, playingIdx, votes, onSelect }: TileViewProps) {
    return (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(5px, 50px))', gap: '4px' }}>
            {segments.map((s, idx) => {
                const vote = votes[s.index];
                const isPlaying = idx === playingIdx;
                const base = !vote ? 'bg-slate-700/60' : vote === 'accept' ? 'bg-emerald-500/70' : 'bg-rose-500/70';
                const border = isPlaying ? 'ring-2 ring-white shadow-[0_0_0_2px_rgba(255,255,255,0.35)]' : '';
                return (
                    <button
                        key={`tile-${s.index}-${idx}`}
                        className={`aspect-square rounded-sm ${base} ${border}`}
                        title={`#${s.index} · ${s.duration.toFixed(2)}s`}
                        onClick={() => onSelect(idx)}
                    />
                );
            })}
        </div>
    );
}
