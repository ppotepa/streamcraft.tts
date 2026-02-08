import React from 'react';
import AudioPlayer from '../../../shared/media/AudioPlayer';
import type { AudioSegment } from '../../../shared/media/AudioPlayer';

export interface PlayerSegment {
    index: number;
    start: number;
    end: number;
    duration: number;
}

export type PlayerVote = 'accept' | 'reject';

export interface PlayerTranscript {
    state: 'pending' | 'done';
    text?: string;
}

interface PlayerPanelProps {
    current?: PlayerSegment;
    vote?: PlayerVote;
    transcript?: PlayerTranscript;
    audioSrc?: string;
    playToken: number;
    onAccept: () => void;
    onReject: () => void;
    onAudioLoading?: (percent: number) => void;
    onAudioReady?: () => void;
    onAudioError?: (message: string) => void;
}

/**
 * Audio player with accept/reject controls and transcript display.
 */
export function PlayerPanel({ current, vote, transcript, audioSrc, playToken, onAccept, onReject, onAudioLoading, onAudioReady, onAudioError }: PlayerPanelProps) {
    // Memoize segment to prevent unnecessary re-creation with same values
    const currentAudioSegment: AudioSegment | undefined = React.useMemo(
        () => current ? { start: current.start, end: current.end, label: `Segment #${current.index}` } : undefined,
        [current?.start, current?.end, current?.index]
    );

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
                onLoading={onAudioLoading}
                onReady={onAudioReady}
                onError={onAudioError}
            />

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-slate-300">Segment {current ? `#${current.index}` : ''}</p>
                        {current && (
                            <p className="text-xs text-slate-400">
                                {current.start.toFixed(2)}s → {current.end.toFixed(2)}s · {current.duration.toFixed(2)}s
                            </p>
                        )}
                    </div>
                    {vote && (
                        <span
                            className={`px-2 py-1 rounded text-xs ${vote === 'accept' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-rose-500/20 text-rose-200'
                                }`}
                        >
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
                {current && transcript && (
                    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-200">
                        <p className="font-semibold mb-1">Transcript</p>
                        <p>{transcript.state === 'pending' ? 'Transcribing…' : transcript.text}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
