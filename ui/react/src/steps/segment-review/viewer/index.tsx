import React from 'react';
import { TileView, TileSegment, TileVote } from './TileView';
import { Timeline, TimelineSegment, TimelineVote } from './Timeline';
import { PlayerPanel, PlayerSegment, PlayerVote, PlayerTranscript } from './PlayerPanel';

export type ViewerSegment = TileSegment &
    TimelineSegment &
    PlayerSegment & {
        rmsDb?: number;
    };

export type { TileVote, PlayerTranscript };

interface SegmentViewerProps {
    segments: ViewerSegment[];
    playingIdx: number;
    votes: Record<number, TileVote>;
    transcripts: Record<number, PlayerTranscript>;
    audioSrc?: string;
    playToken: number;
    current?: ViewerSegment;
    onSelect: (idx: number) => void;
    onAccept: () => void;
    onReject: () => void;
}

/**
 * Main viewer for segment review: tiles + timeline + player.
 * Presents different views of the same data; all state lives in parent.
 */
export function SegmentViewer({
    segments,
    playingIdx,
    votes,
    transcripts,
    audioSrc,
    playToken,
    current,
    onSelect,
    onAccept,
    onReject,
}: SegmentViewerProps) {
    const vote = current ? votes[current.index] : undefined;
    const transcript = current ? transcripts[current.index] : undefined;

    return (
        <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto">
            <div className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded border text-xs border-accent text-accent">Tinder tiles</span>
                    <button
                        className="px-2 py-1 rounded border text-xs border-slate-700 text-slate-300"
                        onClick={() => onSelect(playingIdx)}
                    >
                        Focus current
                    </button>
                </div>
                <span className="text-slate-400 text-xs">
                    Enter = Accept · Spacja = Reject · ↑/↓ = nawigacja · jeden player
                </span>
            </div>
            <TileView segments={segments} playingIdx={playingIdx} votes={votes} onSelect={onSelect} />
            <Timeline segments={segments} playingIdx={playingIdx} votes={votes as Record<number, TimelineVote>} onSelect={onSelect} />
            <PlayerPanel
                current={current}
                vote={vote as PlayerVote}
                transcript={transcript}
                audioSrc={audioSrc}
                playToken={playToken}
                onAccept={onAccept}
                onReject={onReject}
            />
        </div>
    );
}
