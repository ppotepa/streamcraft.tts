/**
 * Audio Quality Display component
 * Displays audio quality metrics with visual indicators
 */

import React from 'react';
import { AudioQualityDisplayProps } from './audio-quality-display.props';

export const AudioQualityDisplay: React.FC<AudioQualityDisplayProps> = ({
    rmsDb,
    peakDb,
    qualityScore,
    isSilence,
    isClipping,
}) => {
    const getQualityColor = (): string => {
        if (isSilence) return 'text-gray-500';
        if (isClipping) return 'text-red-600';
        if (qualityScore >= 0.8) return 'text-green-600';
        if (qualityScore >= 0.5) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getQualityLabel = (): string => {
        if (isSilence) return 'Silent';
        if (isClipping) return 'Clipping';
        if (qualityScore >= 0.8) return 'Excellent';
        if (qualityScore >= 0.5) return 'Good';
        return 'Poor';
    };

    const formatDb = (db: number): string => {
        return `${db.toFixed(2)} dB`;
    };

    return (
        <div className="audio-quality-display border rounded-lg p-4 bg-white">
            <h3 className="text-lg font-semibold mb-4">Audio Quality</h3>

            <div className="space-y-4">
                {/* Quality Score */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                            Overall Quality
                        </span>
                        <span className={`text-sm font-bold ${getQualityColor()}`}>
                            {getQualityLabel()} ({(qualityScore * 100).toFixed(0)}%)
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                            className={`h-3 rounded-full transition-all duration-300 ${isSilence
                                    ? 'bg-gray-400'
                                    : isClipping
                                        ? 'bg-red-500'
                                        : qualityScore >= 0.8
                                            ? 'bg-green-500'
                                            : qualityScore >= 0.5
                                                ? 'bg-yellow-500'
                                                : 'bg-red-500'
                                }`}
                            style={{ width: `${qualityScore * 100}%` }}
                        />
                    </div>
                </div>

                {/* RMS Level */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">RMS Level</span>
                        <span className="text-sm text-gray-600 font-mono">
                            {formatDb(rmsDb)}
                        </span>
                    </div>
                    {isSilence && (
                        <p className="text-xs text-gray-500">⚠️ Audio is silent</p>
                    )}
                </div>

                {/* Peak Level */}
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">
                            Peak Level
                        </span>
                        <span className="text-sm text-gray-600 font-mono">
                            {formatDb(peakDb)}
                        </span>
                    </div>
                    {isClipping && (
                        <p className="text-xs text-red-600">⚠️ Audio is clipping</p>
                    )}
                </div>

                {/* Status Indicators */}
                <div className="pt-4 border-t">
                    <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1">
                            <span
                                className={`w-2 h-2 rounded-full ${isSilence ? 'bg-gray-500' : 'bg-green-500'
                                    }`}
                            />
                            <span className="text-gray-600">
                                {isSilence ? 'Silent' : 'Active'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span
                                className={`w-2 h-2 rounded-full ${isClipping ? 'bg-red-500' : 'bg-green-500'
                                    }`}
                            />
                            <span className="text-gray-600">
                                {isClipping ? 'Clipping' : 'Clean'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
