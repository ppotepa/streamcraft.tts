/**
 * TranscriptionBubble component - displays a single transcribed segment as a chat bubble
 */

import React from 'react';
import { useHoverStore } from '../../../application/shared/useHoverStore';

export interface TranscriptionWord {
    word: string;
    start: number;
    end: number;
    probability: number;
}

export interface TranscriptionBubbleProps {
    segmentIndex: number;
    text: string;
    words: TranscriptionWord[];
    avatarUrl: string | null;
    timestamp: number; // Segment start time in seconds
    audioSource: 'clean' | 'original';
    kept: boolean;
    onClick?: () => void;
}

export const TranscriptionBubble: React.FC<TranscriptionBubbleProps> = ({
    segmentIndex,
    text,
    words,
    avatarUrl,
    timestamp,
    audioSource,
    kept,
    onClick,
}) => {
    const formatTimestamp = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getBubbleColor = (): string => {
        if (!kept) return 'bg-red-50 border-red-200';
        if (audioSource === 'original') return 'bg-gray-100 border-gray-300';
        return 'bg-green-50 border-green-200';
    };

    const { hoveredSegmentIndex, setHoveredSegment } = useHoverStore();
    const isHovered = hoveredSegmentIndex === segmentIndex;

    return (
        <div
            className={`flex items-start gap-3 py-2 px-4 mb-2 animate-slide-in-right cursor-pointer rounded-lg transition-all group ${isHovered
                    ? 'bg-blue-500/20 ring-2 ring-blue-400 shadow-lg shadow-blue-500/30'
                    : 'hover:bg-white/5'
                }`}
            onClick={onClick}
            onMouseEnter={() => setHoveredSegment(segmentIndex)}
            onMouseLeave={() => setHoveredSegment(null)}
        >
            {/* Avatar */}
            <div className="flex-shrink-0 pt-1">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt="Streamer avatar"
                        className="w-11 h-11 rounded-full border-2 border-blue-500/50 object-cover"
                        onError={(e) => {
                            console.error('Avatar failed to load:', avatarUrl);
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                        #{segmentIndex}
                    </div>
                )}
            </div>

            {/* Message content */}
            <div className="flex-1 min-w-0">
                <div
                    className="telegram-bubble rounded-2xl px-4 py-3 shadow-lg max-w-[85%]"
                >
                    {/* Header with timestamp and source */}
                    <div className="flex items-center justify-between mb-2 text-xs opacity-70">
                        <span className="font-semibold text-white/90">Segment {segmentIndex}</span>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${audioSource === 'clean' ? 'bg-green-500/30 text-green-300' : 'bg-gray-500/30 text-gray-300'
                                }`}>
                                {audioSource}
                            </span>
                            {!kept && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/30 text-red-300">
                                    rejected
                                </span>
                            )}
                            <span className="text-white/70">{formatTimestamp(timestamp)}</span>
                        </div>
                    </div>

                    {/* Transcribed text */}
                    <div className="text-base leading-relaxed text-white">
                        {words.length > 0 ? (
                            <span>
                                {words.map((word, idx) => (
                                    <span
                                        key={idx}
                                        className="hover:bg-blue-500/20 rounded px-0.5 cursor-help transition-colors"
                                        title={`${word.start.toFixed(2)}s - ${word.end.toFixed(2)}s (${(word.probability * 100).toFixed(0)}%)`}
                                    >
                                        {word.word}
                                    </span>
                                ))}
                            </span>
                        ) : (
                            <p>{text}</p>
                        )}
                    </div>

                    {/* Word-level confidence indicator */}
                    {words.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-white/10">
                            <div className="flex items-center gap-2 text-xs text-white/60">
                                <span>Confidence:</span>
                                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${words.reduce((sum, w) => sum + w.probability, 0) / words.length > 0.8
                                            ? 'bg-green-400'
                                            : words.reduce((sum, w) => sum + w.probability, 0) / words.length > 0.6
                                                ? 'bg-yellow-400'
                                                : 'bg-red-400'
                                            }`}
                                        style={{
                                            width: `${(words.reduce((sum, w) => sum + w.probability, 0) / words.length * 100)}%`
                                        }}
                                    />
                                </div>
                                <span className="font-medium text-white/80">
                                    {((words.reduce((sum, w) => sum + w.probability, 0) / words.length) * 100).toFixed(0)}%
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
