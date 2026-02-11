/**
 * Store for managing transcription feed state
 */

import { create } from 'zustand';
import { TranscriptionSegment } from '../presentation/components/transcription/TranscriptionFeed';

interface TranscriptionFeedState {
    segments: Map<number, TranscriptionSegment>;
    avatarUrl: string | null;
    addSegment: (segment: TranscriptionSegment) => void;
    clearSegments: () => void;
    setAvatarUrl: (url: string | null) => void;
    getSegmentsList: () => TranscriptionSegment[];
}

export const useTranscriptionFeedStore = create<TranscriptionFeedState>((set, get) => ({
    segments: new Map(),
    avatarUrl: null,

    addSegment: (segment: TranscriptionSegment) => {
        set((state) => {
            const newSegments = new Map(state.segments);
            newSegments.set(segment.segmentIndex, segment);
            return { segments: newSegments };
        });
    },

    clearSegments: () => {
        set({ segments: new Map() });
    },

    setAvatarUrl: (url: string | null) => {
        set({ avatarUrl: url });
    },

    getSegmentsList: () => {
        const segments = Array.from(get().segments.values());
        // Sort by segment index
        segments.sort((a, b) => a.segmentIndex - b.segmentIndex);
        return segments;
    },
}));
