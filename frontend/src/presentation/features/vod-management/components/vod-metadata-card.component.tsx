/**
 * VOD Metadata Card component
 * Displays VOD information and allows job creation
 */

import React, { useState } from 'react';
import { VodMetadataCardProps } from './vod-metadata-card.props';

export const VodMetadataCard: React.FC<VodMetadataCardProps> = ({
    vodId,
    streamer,
    title,
    durationSeconds,
    previewUrl,
    platform,
    description,
    url,
    viewCount,
    createdAt,
    publishedAt,
    language,
    userLogin,
    videoType,
    gameName,
    onCreateJob,
}) => {
    const [previewFailed, setPreviewFailed] = useState(false);

    const formatDuration = (seconds: number): string => {
        if (!Number.isFinite(seconds)) {
            return 'Unknown';
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}h ${minutes}m ${secs}s`;
    };

    const viewCountText =
        typeof viewCount === 'number' && Number.isFinite(viewCount)
            ? viewCount.toLocaleString()
            : 'Unknown';

    const handleCreateJob = (): void => {
        if (onCreateJob) {
            onCreateJob(vodId);
        }
    };

    const showPreview = Boolean(previewUrl) && !previewFailed;

    return (
        <div className="vod-metadata-card glass rounded-2xl p-4">
            <div className="vod-preview mb-3">
                {showPreview ? (
                    <img
                        src={previewUrl ?? undefined}
                        alt={title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => setPreviewFailed(true)}
                        className="w-full h-48 object-cover rounded-xl"
                    />
                ) : (
                    <div className="h-48 w-full rounded-xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 flex items-center justify-center">
                        <span className="text-xs text-slate-400">Preview not available</span>
                    </div>
                )}
            </div>

            <div className="vod-info">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-white truncate">{title}</h3>
                    <span className="text-xs px-2 py-1 rounded-full accent-chip">
                        {platform}
                    </span>
                </div>

                <p className="text-sm text-slate-300 mb-2">{streamer}</p>

                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs text-slate-400">
                        Duration: {formatDuration(durationSeconds)}
                    </span>
                    <span className="text-xs text-slate-500 mono">{vodId}</span>
                </div>

                <div className="grid gap-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Channel</span>
                        <span className="text-slate-100">{userLogin ?? streamer}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Views</span>
                        <span className="text-slate-100">{viewCountText}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Language</span>
                        <span className="text-slate-100">{language ?? 'Unknown'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Game</span>
                        <span className="text-slate-100">{gameName ?? 'Unknown'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Type</span>
                        <span className="text-slate-100">{videoType ?? 'Unknown'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-400">Published</span>
                        <span className="text-slate-100">{publishedAt ?? createdAt ?? 'Unknown'}</span>
                    </div>
                </div>

                {description && (
                    <p className="mt-3 text-xs text-slate-400 line-clamp-3">{description}</p>
                )}

                {url && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-xs text-amber-300 hover:text-amber-200"
                    >
                        Open on {platform}
                    </a>
                )}

                <button
                    onClick={handleCreateJob}
                    className="w-full primary-btn font-semibold py-2.5 px-4 rounded-xl transition-all"
                >
                    Create Job
                </button>
            </div>
        </div>
    );
};
