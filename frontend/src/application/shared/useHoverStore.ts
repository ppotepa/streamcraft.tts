/**
 * Store for managing hover state across components
 */

import { create } from 'zustand';

interface HoverState {
    hoveredSegmentIndex: number | null;
    setHoveredSegment: (index: number | null) => void;
}

export const useHoverStore = create<HoverState>((set) => ({
    hoveredSegmentIndex: null,
    setHoveredSegment: (index) => set({ hoveredSegmentIndex: index }),
}));
