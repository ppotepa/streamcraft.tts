/**
 * Transcript Cue List component
 * Displays a list of transcript cues with timing and confidence
 */

import React from 'react';
import { TranscriptCueListProps } from './transcript-cue-list.props';

export const TranscriptCueList: React.FC<TranscriptCueListProps> = ({
    cues,
    onCueClick,
    highlightedIndex,
}) => {
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    const getConfidenceColor = (confidence: number | null): string => {
        if (confidence === null) return 'text-gray-400';
        if (confidence >= 0.8) return 'text-green-600';
        if (confidence >= 0.5) return 'text-yellow-600';
        return 'text-red-600';
    };

    const handleCueClick = (cue: TranscriptCue, index: number): void => {
        if (onCueClick) {
            onCueClick(cue, index);
        }
    };

    if (cues.length === 0) {
        return (
            <div className="transcript-cue-list-empty flex items-center justify-center py-8">
                <p className="text-gray-500 text-sm">No transcript cues available</p>
            </div>
        );
    }

    return (
        <div className="transcript-cue-list space-y-2 max-h-96 overflow-y-auto">
            {cues.map((cue, index) => (
                <div
                    key={index}
                    onClick={() => handleCueClick(cue, index)}
                    className={`cue-item border rounded p-3 cursor-pointer transition-colors ${highlightedIndex === index
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                >
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                            <span>{formatTime(cue.startTimeSeconds)}</span>
                            <span>→</span>
                            <span>{formatTime(cue.endTimeSeconds)}</span>
                        </div>
                        {cue.confidence !== null && (
                            <span
                                className={`text-xs font-medium ${getConfidenceColor(cue.confidence)}`}
                            >
                                {(cue.confidence * 100).toFixed(0)}%
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-900">{cue.text}</p>
                </div>
            ))}
        </div>
    );
};
