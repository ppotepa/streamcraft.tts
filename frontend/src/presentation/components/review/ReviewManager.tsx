/**
 * Review Manager Component - Integrates TableView, FocusView, and TimelineView
 * 
 * This component demonstrates how to integrate the three review views:
 * - TableView: Main grid interface for bulk operations
 * - FocusView: Modal for deep-dive single-segment review
 * - TimelineView: Alternative horizontal scrolling timeline
 * 
 * @requires CSS: Import 'review-views.css' in your parent component or main app file
 * @example
 * ```tsx
 * import '@/presentation/components/review/review-views.css';
 * import { ReviewManager } from '@/presentation/components/review';
 * ```
 */
import React, { useState } from 'react';
import { TableView, TableViewSegment } from './TableView';
import { FocusView, FocusViewSegment } from './FocusView';
import { TimelineView, TimelineSegment } from './TimelineView';

type ViewMode = 'table' | 'timeline';

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
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [selectedSegments, setSelectedSegments] = useState<Set<number>>(new Set());
    const [focusedSegmentIndex, setFocusedSegmentIndex] = useState<number | null>(null);

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
    const handleSegmentAction = (index: number, action: 'accept' | 'reject' | 'play' | 'edit' | 'skip') => {
        if (action === 'accept') {
            onSegmentAction(index, 'accept');
            onSegmentUpdate(index, { kept: true });
        } else if (action === 'reject') {
            onSegmentAction(index, 'reject');
            onSegmentUpdate(index, { kept: false });
        } else if (action === 'skip') {
            onSegmentAction(index, 'skip');
        } else if (action === 'play') {
            // Handle playback - integrate with existing Waveform component or audio player
            // You can dispatch to your audio player here
            const segment = segments.find(seg => seg.index === index);
            if (segment?.cleanAudioUrl) {
                // Example: playAudioFile(segment.cleanAudioUrl);
            }
        } else if (action === 'edit') {
            // Open in focus view for editing
            setFocusedSegmentIndex(index);
        }
    };

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
            {/* View Mode Switcher */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: '#1a1e26',
                borderRadius: '8px',
                alignItems: 'center'
            }}>
                <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#e3e8f0' }}>
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
                            backgroundColor: viewMode === 'table' ? '#4a9eff' : '#1a1e26',
                            color: viewMode === 'table' ? 'white' : '#a3adbf'
                        }}
                        onClick={() => setViewMode('table')}
                    >
                        📊 Table View
                    </button>
                    <button
                        className="action-btn"
                        style={{
                            backgroundColor: viewMode === 'timeline' ? '#4a9eff' : '#1a1e26',
                            color: viewMode === 'timeline' ? 'white' : '#a3adbf'
                        }}
                        onClick={() => setViewMode('timeline')}
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

            {/* Main View */}
            {viewMode === 'table' && (
                <TableView
                    segments={segments}
                    selectedSegments={selectedSegments}
                    onSegmentSelect={handleSelectSegment}
                    onSelectAll={handleSelectAll}
                    onSegmentDoubleClick={handleOpenFocus}
                    onSegmentAction={handleSegmentAction}
                    onTextEdit={handleTextEdit}
                />
            )}

            {viewMode === 'timeline' && (
                <TimelineView
                    segments={segments}
                    onSegmentClick={handleOpenFocus}
                    onSegmentAction={handleSegmentAction}
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
