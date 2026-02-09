import React from 'react';

/**
 * Skeleton loading placeholder for VodMetadataCard
 * Shows animated shimmer effect while fetching VOD metadata
 */
export default function VodMetadataCardSkeleton(): JSX.Element {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 animate-fadeIn"
            style={{ animationDuration: '0.4s' }}>
            <div className="flex gap-4">
                {/* Thumbnail skeleton */}
                <div className="flex-shrink-0 animate-fadeIn" style={{ animationDelay: '0.1s', animationDuration: '0.3s' }}>
                    <div className="w-40 h-[90px] rounded-lg bg-slate-800 animate-pulse relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/20 to-transparent animate-shimmer"></div>
                    </div>
                </div>

                {/* Details skeleton */}
                <div className="flex-1 min-w-0 space-y-2 animate-fadeIn" style={{ animationDelay: '0.2s', animationDuration: '0.3s' }}>
                    {/* Platform badge skeleton */}
                    <div className="inline-flex">
                        <div className="h-6 w-20 rounded-full bg-slate-800 animate-pulse relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/20 to-transparent animate-shimmer"></div>
                        </div>
                    </div>

                    {/* Title and streamer skeleton */}
                    <div className="space-y-2">
                        <div className="h-4 w-full rounded bg-slate-800 animate-pulse relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/20 to-transparent animate-shimmer"
                                style={{ animationDelay: '0.2s' }}></div>
                        </div>
                        <div className="h-4 w-3/4 rounded bg-slate-800 animate-pulse relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/20 to-transparent animate-shimmer"
                                style={{ animationDelay: '0.3s' }}></div>
                        </div>
                        <div className="h-3 w-32 rounded bg-slate-800 animate-pulse relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/20 to-transparent animate-shimmer"
                                style={{ animationDelay: '0.4s' }}></div>
                        </div>
                    </div>

                    {/* Metadata icons skeleton */}
                    <div className="flex items-center gap-3">
                        <div className="h-3 w-16 rounded bg-slate-800 animate-pulse relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/20 to-transparent animate-shimmer"
                                style={{ animationDelay: '0.5s' }}></div>
                        </div>
                        <div className="h-3 w-20 rounded bg-slate-800 animate-pulse relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-700/20 to-transparent animate-shimmer"
                                style={{ animationDelay: '0.6s' }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
