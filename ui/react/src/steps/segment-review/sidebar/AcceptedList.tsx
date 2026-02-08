import React from 'react';

export interface AcceptedSegment {
    index: number;
    start: number;
    end: number;
    duration: number;
}

export interface TranscriptJob {
    state: 'pending' | 'done';
    text?: string;
}

interface AcceptedListProps {
    segments: AcceptedSegment[];
    transcripts: Record<number, TranscriptJob>;
    playingIndex?: number;
    onJumpTo: (segmentIndex: number) => void;
    onTranscriptChange: (segmentIndex: number, text: string) => void;
}

/**
 * Sidebar list of accepted segments with transcripts and editing.
 */
export function AcceptedList({ segments, transcripts, playingIndex, onJumpTo, onTranscriptChange }: AcceptedListProps) {
    return (
        <div className="w-80 border-l border-slate-800 bg-slate-900/70 p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-200">Zaakceptowane</p>
                    <p className="text-[11px] text-slate-500">Auto-transkrypcja w tle + edycja ręczna</p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-200">{segments.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {segments.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                        Zatwierdź segment (Enter), pojawi się tutaj do transkrypcji.
                    </div>
                )}
                {segments.map((s, idx) => {
                    const transcript = transcripts[s.index];
                    const isPlaying = s.index === playingIndex;
                    return (
                        <div
                            key={`sidebar-${s.index}-${idx}`}
                            className={`rounded-lg border px-3 py-2 text-xs transition ${isPlaying ? 'ring-2 ring-white/70 shadow-[0_0_0_2px_rgba(255,255,255,0.35)]' : ''
                                } border-emerald-500/40 bg-emerald-500/5 text-emerald-100`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold">#{s.index}</div>
                                <div className="text-[11px] text-emerald-200/80">{s.duration.toFixed(2)}s</div>
                                <button
                                    className="text-[11px] px-2 py-1 rounded bg-slate-950/60 border border-slate-700 text-slate-200 hover:border-accent"
                                    onClick={() => onJumpTo(s.index)}
                                >
                                    Odtwórz
                                </button>
                            </div>
                            <div className="text-[11px] text-slate-300">
                                {s.start.toFixed(2)}s → {s.end.toFixed(2)}s
                            </div>
                            {transcript?.state === 'pending' && (
                                <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-200">
                                    <div className="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                    <span>Transkrypcja…</span>
                                </div>
                            )}
                            {transcript?.state === 'done' && (
                                <div className="mt-2 space-y-1">
                                    <textarea
                                        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[12px] text-slate-100"
                                        rows={2}
                                        value={transcript.text ?? ''}
                                        onChange={(e) => onTranscriptChange(s.index, e.target.value)}
                                    />
                                    <div className="text-[11px] text-slate-500">Auto-zapisane</div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
