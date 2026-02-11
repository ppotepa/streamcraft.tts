/**
 * Timeline View Component - Horizontal scrolling card timeline
 * 
 * Alternative view displaying segments as cards in a timeline:
 * - Horizontal scrolling layout
 * - Card-based design with mini waveforms
 * - Visual browsing experience
 * - Metrics and status on each card
 * - Click to open focus view
 * 
 * @component
 */
import React from 'react';

export interface TimelineSegment {
    index: number;
    start: number;
    end: number;
    duration: number;
    text: string;
    confidence?: number;
    snrDb?: number;
    speechRatio?: number;
    kept?: boolean | null;
    rejectReason?: string[];
}

export interface TimelineViewProps {
    segments: TimelineSegment[];
    onSegmentClick: (segment: TimelineSegment) => void;
    onSegmentAction: (index: number, action: 'accept' | 'reject' | 'play' | 'edit') => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
    segments,
    onSegmentClick,
    onSegmentAction,
}) => {
    // Early return for empty state
    if (segments.length === 0) {
        return (
            <div className="timeline-view" style={{
                padding: '48px',
                textAlign: 'center',
                color: '#a3adbf'
            }}>
                <p style={{ fontSize: '1.125rem', marginBottom: '8px' }}>No segments to review</p>
                <p style={{ fontSize: '0.875rem' }}>Start by processing a VOD or uploading audio files.</p>
            </div>
        );
    }

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(1);
        return `${mins}:${secs.padStart(4, '0')}`;
    };

    const getStatusBadge = (segment: TimelineSegment) => {
        if (segment.kept === true) {
            return <div className="status-badge badge-kept">✓ Accepted</div>;
        } else if (segment.kept === false) {
            return <div className="status-badge badge-rejected">✕ Rejected</div>;
        }
        return <div className="status-badge badge-review">⏸ Review</div>;
    };

    const getMetricClass = (value: number | undefined, goodThreshold: number): string => {
        if (!value) return '';
        return value >= goodThreshold ? 'good' : '';
    };

    return (
        <div className="timeline-view">
            <div className="timeline-scroll">
                <div className="timeline-track">
                    {segments.map((segment) => (
                        <div
                            key={segment.index}
                            className={`segment-card ${segment.kept === false ? 'rejected' : ''}`}
                            onDoubleClick={() => onSegmentClick(segment)}
                        >
                            <div className="card-header">
                                <div className="segment-number">{segment.index}</div>
                                <div className="card-status">
                                    {getStatusBadge(segment)}
                                    <span style={{ fontSize: '0.625rem', color: '#a3adbf' }}>clean</span>
                                </div>
                            </div>
                            <div className="card-time">
                                {formatTime(segment.start)} - {formatTime(segment.end)} ({segment.duration.toFixed(1)}s)
                            </div>
                            <div className="card-waveform">
                                {/* Generate mini waveform bars based on segment index for variety */}
                                {Array.from({ length: 10 }, (_, i) => {
                                    const seed = (segment.index * 7 + i * 13) % 100;
                                    const height = 40 + (seed % 50);
                                    return <div key={i} className="mini-bar" style={{ height: `${height}%` }} />;
                                })}
                            </div>
                            <div className="card-text">
                                "{segment.text}"
                            </div>
                            <div className="card-metrics">
                                <div className="metric">
                                    <span className="metric-label">Confidence</span>
                                    <span className={`metric-value ${getMetricClass(segment.confidence, 90)}`}>
                                        {segment.confidence || 'N/A'}%
                                    </span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">SNR</span>
                                    <span className={`metric-value ${getMetricClass(segment.snrDb, 15)}`}>
                                        {segment.snrDb ? `${segment.snrDb.toFixed(1)} dB` : 'N/A'}
                                    </span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Speech</span>
                                    <span className={`metric-value ${getMetricClass(segment.speechRatio, 90)}`}>
                                        {segment.speechRatio ? `${segment.speechRatio}%` : 'N/A'}
                                    </span>
                                </div>
                                <div className="metric">
                                    <span className="metric-label">Duration</span>
                                    <span className="metric-value">{segment.duration.toFixed(1)}s</span>
                                </div>
                            </div>
                            <div className="card-actions">
                                <button
                                    className="action-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSegmentAction(segment.index, 'play');
                                    }}
                                >
                                    ▶ Play
                                </button>
                                <button
                                    className="action-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSegmentAction(segment.index, 'edit');
                                    }}
                                >
                                    ✎ Edit
                                </button>
                                <button
                                    className="action-btn accept"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSegmentAction(segment.index, 'accept');
                                    }}
                                >
                                    ✓
                                </button>
                                <button
                                    className="action-btn reject"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSegmentAction(segment.index, 'reject');
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
