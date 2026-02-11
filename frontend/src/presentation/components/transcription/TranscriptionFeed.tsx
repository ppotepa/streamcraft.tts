/**
 * TranscriptionFeed component - displays transcriptions in chat-style feed
 */

import React, { useEffect, useRef } from 'react';
import { TranscriptionBubble, TranscriptionWord } from './TranscriptionBubble';

export interface TranscriptionSegment {
    segmentIndex: number;
    text: string;
    words: TranscriptionWord[];
    timestamp: number;
    audioSource: 'clean' | 'original';
    kept: boolean;
}

export interface TranscriptionFeedProps {
    segments: TranscriptionSegment[];
    avatarUrl: string | null;
    onSegmentClick: (segmentIndex: number) => void;
    autoScroll?: boolean;
}

export const TranscriptionFeed: React.FC<TranscriptionFeedProps> = ({
    segments,
    avatarUrl,
    onSegmentClick,
    autoScroll = true,
}) => {
    const feedEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new segments are added
    useEffect(() => {
        if (autoScroll && feedEndRef.current) {
            feedEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [segments.length, autoScroll]);

    return (
        <div
            ref={containerRef}
            className="flex flex-col flex-1 overflow-y-auto px-8 py-6 telegram-chat-bg"
            style={{ scrollBehavior: 'smooth' }}
        >
            {segments.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <svg
                            className="w-20 h-20 mx-auto mb-4 text-slate-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                            />
                        </svg>
                        <p className="text-xl font-medium text-slate-300">No messages yet</p>
                        <p className="text-sm mt-2 text-slate-500">
                            Play segments to see transcriptions here
                        </p>
                    </div>
                </div>
            ) : (
                <>
                    {segments.map((segment) => (
                        <TranscriptionBubble
                            key={segment.segmentIndex}
                            segmentIndex={segment.segmentIndex}
                            text={segment.text}
                            words={segment.words}
                            avatarUrl={avatarUrl}
                            timestamp={segment.timestamp}
                            audioSource={segment.audioSource}
                            kept={segment.kept}
                            onClick={() => onSegmentClick(segment.segmentIndex)}
                        />
                    ))}
                    <div ref={feedEndRef} />
                </>
            )}
        </div>
    );
};
