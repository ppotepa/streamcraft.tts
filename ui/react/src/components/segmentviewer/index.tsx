import React from 'react';
import AudioPlayer from '../../shared/media/AudioPlayer';
import type { AudioSegment } from '../../shared/media/AudioPlayer';
import { TileView, TileSegment, TileVote } from './TileView';

// Presentation wrapper for the Tinder-style segment review UI; parent holds state.
export type ViewerSegment = TileSegment & {
    start: number;
    end: number;
    rmsDb?: number;
};

export type TranscriptJob = {
    state: 'pending' | 'done';
    text?: string;
};

export type { TileVote, TileSegment };

interface SegmentViewerProps {
    segments: ViewerSegment[];
    playingIdx: number;
    votes: Record<number, TileVote>;
    transcripts: Record<number, TranscriptJob>;
    audioSrc?: string;
    playToken: number;
    current?: ViewerSegment;
    onSelect: (idx: number) => void;
    onAccept: () => void;
    onReject: () => void;
}

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
    const totalDuration = segments.length ? Math.max(...segments.map((s) => s.end)) : 0;

    const currentAudioSegment: AudioSegment | undefined = current
        ? { start: current.start, end: current.end, label: `Segment #${current.index}` }
        : undefined;

    const renderTimeline = () => (
        <div className="relative w-full h-24 rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="absolute inset-x-4 inset-y-3">
                {segments.map((s, idx) => {
                    const vote = votes[s.index];
                    const color = !vote ? 'bg-slate-700/70 border-slate-600' : vote === 'accept' ? 'bg-emerald-500/80 border-emerald-400' : 'bg-rose-500/80 border-rose-400';
                    const startPct = (s.start / (totalDuration || 1)) * 100;
                    const widthPct = (s.duration / (totalDuration || 1)) * 100;
                    const isPlaying = idx === playingIdx;
                    return (
                        <button
                            key={`timeline-${s.index}-${idx}`}
                            className={`absolute top-0 h-full border-2 ${color} ${isPlaying ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900 shadow-[0_0_0_2px_rgba(255,255,255,0.35)]' : ''} hover:brightness-110`}
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

    const renderPlayer = () => {
        const vote = current ? votes[current.index] : undefined;
        return (
            <div className="space-y-4 w-full">
                <AudioPlayer
                    audioSrc={audioSrc}
                    mode="full"
                    segment={currentAudioSegment}
                    autoPlay={false}
                    playToken={playToken}
                    highlightSegment={currentAudioSegment}
                    onSegmentEnd={() => { }}
                />

                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-300">Segment {current ? `#${current.index}` : ''}</p>
                            {current && (
                                <p className="text-xs text-slate-400">{current.start.toFixed(2)}s → {current.end.toFixed(2)}s · {current.duration.toFixed(2)}s</p>
                            )}
                        </div>
                        {vote && (
                            <span className={`px-2 py-1 rounded text-xs ${vote === 'accept' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'}`}>
                                {vote === 'accept' ? 'Accepted' : 'Rejected'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            className="px-4 py-2 rounded border border-slate-700 text-rose-400 hover:border-rose-500 hover:text-rose-300 text-sm"
                            onClick={onReject}
                        >
                            Reject (Space)
                        </button>
                        <button
                            className="px-4 py-2 rounded border border-slate-700 text-emerald-300 hover:border-emerald-500 hover:text-emerald-200 text-sm"
                            onClick={onAccept}
                        >
                            Accept (Enter)
                        </button>
                    </div>
                    {current && transcripts[current.index] && (
                        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
                            <p className="font-semibold mb-1">Transcript</p>
                            <p>{transcripts[current.index].state === 'pending' ? 'Transcribing…' : transcripts[current.index].text}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

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
                <span className="text-slate-400 text-xs">Enter = Accept · Spacja = Reject · ↑/↓ = nawigacja · jeden player</span>
            </div>
            <TileView segments={segments} playingIdx={playingIdx} votes={votes} onSelect={onSelect} />
            {renderTimeline()}
            {renderPlayer()}
        </div>
    );
}
