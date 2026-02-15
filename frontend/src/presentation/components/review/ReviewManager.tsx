/**
 * Review Manager Component - Integrates TableView, FocusView, and TimelineView
 * 
 * This component demonstrates how to integrate the three review views:
 * - TableView: Main grid interface for bulk operations (always visible)
 * - FocusView: Modal for deep-dive single-segment review
 * - TimelineView: Fullscreen modal for horizontal slot-machine style review
 * 
 * @requires CSS: Import 'review-views.css' in your parent component or main app file
 * @example
 * ```tsx
 * import '@/presentation/components/review/review-views.css';
 * import { ReviewManager } from '@/presentation/components/review';
 * ```
 */
import React, { useState, useCallback } from 'react';
import { TableView, TableViewSegment } from './TableView';
import { FocusView, FocusViewSegment } from './FocusView';
import { TimelineView, TimelineSegment } from './TimelineView';
import { useAudioPlayer } from '../../context/audio-player.context';

export interface ReviewManagerProps {
    segments: FocusViewSegment[]; // Use FocusViewSegment as it has all fields
    onSegmentUpdate: (index: number, updates: Partial<FocusViewSegment>) => void;
    onSegmentAction: (index: number, action: 'accept' | 'reject' | 'skip') => void;
}

export const ReviewManager: React.FC<ReviewManagerProps> = ({
    segments,
    onSegmentUpdate,
    onSegmentAction,
}) => {
    const [selectedSegments, setSelectedSegments] = useState<Set<number>>(new Set());
    const [focusedSegmentIndex, setFocusedSegmentIndex] = useState<number | null>(null);
    const [isTimelineOpen, setIsTimelineOpen] = useState(false);
    const { playSegment, currentSegmentId } = useAudioPlayer();

    const reviewPlaylist = segments
        .map((segment) => {
            const cleanStart = segment.cleanStart;
            const cleanEnd = segment.cleanEnd;
            const originalStart = segment.start;
            const originalEnd = segment.end;

            const hasCleanWindow = Number.isFinite(cleanStart) && Number.isFinite(cleanEnd) && (cleanEnd as number) > (cleanStart as number);
            const hasOriginalWindow = Number.isFinite(originalStart) && Number.isFinite(originalEnd) && originalEnd > originalStart;

            if (segment.kept !== false && segment.cleanAudioUrl && hasCleanWindow) {
                return {
                    id: segment.index,
                    src: segment.cleanAudioUrl,
                    label: `Segment #${segment.index}`,
                    startAt: cleanStart as number,
                    endAt: cleanEnd as number,
                };
            }

            if (segment.originalAudioUrl && hasOriginalWindow) {
                return {
                    id: segment.index,
                    src: segment.originalAudioUrl,
                    label: `Segment #${segment.index}`,
                    startAt: originalStart,
                    endAt: originalEnd,
                };
            }

            if (!segment.cleanAudioUrl) {
                return null;
            }

            const fallbackStart = Number.isFinite(cleanStart) ? (cleanStart as number) : 0;
            const fallbackEnd = Number.isFinite(segment.duration) ? fallbackStart + segment.duration : undefined;

            return {
                id: segment.index,
                src: segment.cleanAudioUrl,
                label: `Segment #${segment.index}`,
                startAt: fallbackStart,
                endAt: Number.isFinite(fallbackEnd) ? fallbackEnd : undefined,
            };
        })
        .filter((item): item is { id: number; src: string; label: string; startAt: number; endAt?: number } => item !== null);

    // Handle segment selection
    const handleSelectSegment = (index: number, selected: boolean) => {
        setSelectedSegments((prev) => {
            const newSet = new Set(prev);
            if (selected) {
                newSet.add(index);
            } else {
                newSet.delete(index);
            }
            return newSet;
        });
    };

    const handleSelectAll = (selected: boolean) => {
        if (selected) {
            setSelectedSegments(new Set(segments.map((seg) => seg.index)));
        } else {
            setSelectedSegments(new Set());
        }
    };

    // Handle focus view
    const handleOpenFocus = (segment: TableViewSegment | TimelineSegment) => {
        setFocusedSegmentIndex(segment.index);
    };

    const handleCloseFocus = () => {
        setFocusedSegmentIndex(null);
    };

    const handleFocusNavigate = (direction: 'prev' | 'next') => {
        if (focusedSegmentIndex === null) return;

        const currentIndex = segments.findIndex((seg) => seg.index === focusedSegmentIndex);
        if (currentIndex === -1) return;

        if (direction === 'prev' && currentIndex > 0) {
            setFocusedSegmentIndex(segments[currentIndex - 1].index);
        } else if (direction === 'next' && currentIndex < segments.length - 1) {
            setFocusedSegmentIndex(segments[currentIndex + 1].index);
        }
    };

    // Handle segment actions
    const handleSegmentAction = useCallback((index: number, action: 'accept' | 'reject' | 'play' | 'edit' | 'skip') => {
        if (action === 'accept') {
            onSegmentAction(index, 'accept');
            onSegmentUpdate(index, { kept: true });
        } else if (action === 'reject') {
            onSegmentAction(index, 'reject');
            onSegmentUpdate(index, { kept: false });
        } else if (action === 'skip') {
            onSegmentAction(index, 'skip');
        } else if (action === 'play') {
            const playlistItem = reviewPlaylist.find((item) => item.id === index);
            if (playlistItem) {
                void playSegment({
                    context: isTimelineOpen ? 'timeline' : 'review',
                    playlist: reviewPlaylist,
                    segmentId: index,
                    autoplay: true,
                    startAt: playlistItem.startAt,
                });
            }
        } else if (action === 'edit') {
            // Open in focus view for editing
            setFocusedSegmentIndex(index);
        }
    }, [segments, onSegmentAction, onSegmentUpdate, playSegment, reviewPlaylist, isTimelineOpen]);

    // Handle text editing
    const handleTextEdit = (index: number, newText: string) => {
        onSegmentUpdate(index, { text: newText });
    };

    // Get focused segment and calculate remaining
    const focusedSegment = focusedSegmentIndex !== null
        ? segments.find((seg) => seg.index === focusedSegmentIndex)
        : null;

    const remainingSegments = segments.filter(seg => seg.kept === null).length;

    return (
        <div className="review-manager">
            {/* Header with actions */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: '#161b26',
                borderRadius: '8px',
                alignItems: 'center'
            }}>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#e7e9ee' }}>
                        Manual Review
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#a3adbf' }}>
                        {segments.length} segments • {selectedSegments.size} selected
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        className="action-btn"
                        style={{
                            backgroundColor: '#161b26',
                            color: '#78fff8',
                            borderColor: 'rgba(120, 255, 248, 0.3)'
                        }}
                        onClick={() => setIsTimelineOpen(true)}
                    >
                        📅 Timeline View
                    </button>
                </div>
                {selectedSegments.size > 0 && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className="action-btn accept"
                            onClick={() => {
                                selectedSegments.forEach((index) => {
                                    handleSegmentAction(index, 'accept');
                                });
                                setSelectedSegments(new Set());
                            }}
                        >
                            ✓ Accept Selected ({selectedSegments.size})
                        </button>
                        <button
                            className="action-btn reject"
                            onClick={() => {
                                selectedSegments.forEach((index) => {
                                    handleSegmentAction(index, 'reject');
                                });
                                setSelectedSegments(new Set());
                            }}
                        >
                            ✕ Reject Selected ({selectedSegments.size})
                        </button>
                    </div>
                )}
            </div>

            {/* Table View - Always Rendered */}
            <TableView
                segments={segments}
                selectedSegments={selectedSegments}
                currentPlayingSegmentId={currentSegmentId}
                onSegmentSelect={handleSelectSegment}
                onSelectAll={handleSelectAll}
                onSegmentDoubleClick={handleOpenFocus}
                onSegmentAction={handleSegmentAction}
                onTextEdit={handleTextEdit}
            />

            {/* Timeline View Modal */}
            {isTimelineOpen && (
                <TimelineView
                    segments={segments}
                    currentPlayingSegmentId={currentSegmentId}
                    onSegmentClick={handleOpenFocus}
                    onSegmentAction={handleSegmentAction}
                    onClose={() => setIsTimelineOpen(false)}
                    transcriptSegments={segments.map((segment) => ({
                        index: segment.index,
                        text: segment.text,
                        kept: segment.kept ?? null,
                    }))}
                />
            )}

            {/* Focus View Modal */}
            {focusedSegment && (
                <FocusView
                    segment={focusedSegment}
                    totalSegments={segments.length}
                    remaining={remainingSegments}
                    onClose={handleCloseFocus}
                    onPrevious={() => handleFocusNavigate('prev')}
                    onNext={() => handleFocusNavigate('next')}
                    onTextEdit={(text) => handleTextEdit(focusedSegment.index, text)}
                    onAccept={() => {
                        handleSegmentAction(focusedSegment.index, 'accept');
                        setTimeout(() => handleFocusNavigate('next'), 300);
                    }}
                    onReject={() => {
                        handleSegmentAction(focusedSegment.index, 'reject');
                        setTimeout(() => handleFocusNavigate('next'), 300);
                    }}
                    onSkip={() => {
                        handleFocusNavigate('next');
                    }}
                />
            )}
        </div>
    );
};
