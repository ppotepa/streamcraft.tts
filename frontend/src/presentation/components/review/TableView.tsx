/**
 * Table View Component - Main grid view for segment review
 * 
 * Displays segments in a spreadsheet-like table with:
 * - Column sorting indicators
 * - Bulk checkbox selection
 * - Inline text editing
 * - Status badges and metrics
 * - Action buttons per row
 * - Double-click to open focus view
 * 
 * @component
 */
import React from 'react';

export interface TableViewSegment {
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

export interface TableViewProps {
    segments: TableViewSegment[];
    selectedSegments: Set<number>;
    onSegmentSelect: (index: number, selected: boolean) => void;
    onSegmentDoubleClick: (segment: TableViewSegment) => void;
    onSegmentAction: (index: number, action: 'accept' | 'reject' | 'play') => void;
    onTextEdit: (index: number, newText: string) => void;
    onSelectAll: (selected: boolean) => void;
}

export const TableView: React.FC<TableViewProps> = ({
    segments,
    selectedSegments,
    onSegmentSelect,
    onSegmentDoubleClick,
    onSegmentAction,
    onTextEdit,
    onSelectAll,
}) => {
    // Early return for empty state
    if (segments.length === 0) {
        return (
            <div className="table-view" style={{
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

    const getStatusBadge = (segment: TableViewSegment) => {
        if (segment.kept === true) {
            return <span className="status-badge badge-kept">✓ Accepted</span>;
        } else if (segment.kept === false) {
            return <span className="status-badge badge-rejected">✕ Rejected</span>;
        }
        return <span className="status-badge badge-review">⏸ Review</span>;
    };

    const getMetricClass = (value: number | undefined, goodThreshold: number) => {
        if (!value) return '';
        return value >= goodThreshold ? 'good' : value < goodThreshold * 0.8 ? 'bad' : '';
    };

    const allSelected = segments.length > 0 && selectedSegments.size === segments.length;
    const someSelected = selectedSegments.size > 0 && !allSelected;

    return (
        <div className="table-view">
            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th className="cell-checkbox">
                                <input
                                    type="checkbox"
                                    className="checkbox"
                                    checked={allSelected}
                                    ref={(input) => {
                                        if (input) {
                                            input.indeterminate = someSelected;
                                        }
                                    }}
                                    onChange={(e) => onSelectAll(e.target.checked)}
                                    style={{ cursor: 'pointer' }}
                                />
                            </th>
                            <th className="cell-id sorted"># <span className="sort-icon">▼</span></th>
                            <th className="cell-status">Status</th>
                            <th className="cell-time">Time Range</th>
                            <th className="cell-text">Transcription Text</th>
                            <th className="cell-metrics">Quality Metrics</th>
                            <th className="cell-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {segments.map((segment) => (
                            <tr
                                key={segment.index}
                                className={selectedSegments.has(segment.index) ? 'selected' : ''}
                                onDoubleClick={() => onSegmentDoubleClick(segment)}
                            >
                                <td className="cell-checkbox">
                                    <input
                                        type="checkbox"
                                        className="checkbox"
                                        checked={selectedSegments.has(segment.index)}
                                        onChange={(e) => onSegmentSelect(segment.index, e.target.checked)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </td>
                                <td className="cell-id">{segment.index}</td>
                                <td className="cell-status">{getStatusBadge(segment)}</td>
                                <td className="cell-time">
                                    {formatTime(segment.start)} - {formatTime(segment.end)} ({segment.duration.toFixed(1)}s)
                                </td>
                                <td className="cell-text">
                                    <div
                                        className="text-content"
                                        contentEditable
                                        suppressContentEditableWarning
                                        onBlur={(e) => onTextEdit(segment.index, e.currentTarget.textContent || '')}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {segment.text}
                                    </div>
                                </td>
                                <td className="cell-metrics">
                                    <div className="metrics-inline">
                                        <div className="metric-item">
                                            <span className="metric-label">Conf</span>
                                            <span className={`metric-value ${getMetricClass(segment.confidence, 90)}`}>
                                                {segment.confidence ? `${segment.confidence}%` : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="metric-item">
                                            <span className="metric-label">SNR</span>
                                            <span className={`metric-value ${getMetricClass(segment.snrDb, 15)}`}>
                                                {segment.snrDb ? segment.snrDb.toFixed(1) : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="metric-item">
                                            <span className="metric-label">Speech</span>
                                            <span className={`metric-value ${getMetricClass(segment.speechRatio, 90)}`}>
                                                {segment.speechRatio ? `${segment.speechRatio}%` : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="metric-item">
                                            <span className="metric-label">Dur</span>
                                            <span className="metric-value">{segment.duration.toFixed(1)}s</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="cell-actions">
                                    <div className="action-buttons">
                                        <button
                                            className="icon-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSegmentAction(segment.index, 'play');
                                            }}
                                            title="Play"
                                        >
                                            ▶
                                        </button>
                                        <button
                                            className="icon-btn accept"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSegmentAction(segment.index, 'accept');
                                            }}
                                            title="Accept"
                                        >
                                            ✓
                                        </button>
                                        <button
                                            className="icon-btn reject"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSegmentAction(segment.index, 'reject');
                                            }}
                                            title="Reject"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
