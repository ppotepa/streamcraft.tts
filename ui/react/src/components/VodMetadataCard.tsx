import React from 'react';
import PlatformBadge from './PlatformBadge';
import { VodMeta } from '../api/client';

interface VodMetadataCardProps {
    meta: VodMeta;
}

/**
 * Metadata card displaying VOD info with thumbnail, platform badge, and details
 * Appears after successful VOD validation
 */
export default function VodMetadataCard({ meta }: VodMetadataCardProps): JSX.Element {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 animate-[fadeIn_0.3s_ease-in]">
            <div className="flex gap-4">
                {/* Thumbnail */}
                {meta.previewUrl && (
                    <div className="flex-shrink-0">
                        <img
                            src={meta.previewUrl}
                            alt={meta.title}
                            className="w-40 h-[90px] object-cover rounded-lg border border-slate-700"
                            onError={(e) => {
                                // Fallback if image fails to load
                                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="90"%3E%3Crect width="160" height="90" fill="%23334155"/%3E%3C/svg%3E';
                            }}
                        />
                    </div>
                )}

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start gap-2">
                        <PlatformBadge platform={meta.platform} />
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-slate-100 line-clamp-2">{meta.title}</p>
                        <p className="text-xs text-slate-400 mt-1">Streamer: {meta.streamer}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {meta.duration}
                        </span>
                        <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                            </svg>
                            {meta.vodId}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
