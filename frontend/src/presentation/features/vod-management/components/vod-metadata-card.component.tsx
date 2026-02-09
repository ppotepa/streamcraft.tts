/**
 * VOD Metadata Card component
 * Displays VOD information and allows job creation
 */

import React from 'react';
import { VodMetadataCardProps } from './vod-metadata-card.props';

export const VodMetadataCard: React.FC<VodMetadataCardProps> = ({
    vodId,
    streamer,
    title,
    durationSeconds,
    previewUrl,
    platform,
    onCreateJob,
}) => {
    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}h ${minutes}m ${secs}s`;
    };

    const handleCreateJob = (): void => {
        if (onCreateJob) {
            onCreateJob(vodId);
        }
    };

    return (
        <div className="vod-metadata-card border rounded-lg p-4 shadow-sm bg-white">
            {previewUrl && (
                <div className="vod-preview mb-3">
                    <img
                        src={previewUrl}
                        alt={title}
                        className="w-full h-48 object-cover rounded"
                    />
                </div>
            )}

            <div className="vod-info">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold truncate">{title}</h3>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                        {platform}
                    </span>
                </div>

                <p className="text-sm text-gray-600 mb-2">{streamer}</p>

                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-gray-500">
                        Duration: {formatDuration(durationSeconds)}
                    </span>
                    <span className="text-xs text-gray-500 font-mono">{vodId}</span>
                </div>

                <button
                    onClick={handleCreateJob}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors"
                >
                    Create Job
                </button>
            </div>
        </div>
    );
};
