import React, { useMemo } from 'react';
import WaveformBars from '../shared/media/WaveformBars';

interface AudioPreviewCardProps {
    title: string;
    durationSec: number;
    sampleRate: number;
    isLoading?: boolean;
    hasError?: boolean;
}

export default function AudioPreviewCard({ title, durationSec, sampleRate, isLoading, hasError }: AudioPreviewCardProps) {
    const bars = useMemo(() => Array.from({ length: 60 }, (_, i) => Math.sin(i) * 0.5 + 0.5), []);

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-300">{title}</p>
                    <p className="text-xs text-slate-400">{durationSec}s · {sampleRate} Hz</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <button className="px-3 py-1 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60" disabled={isLoading || hasError}>
                        Play
                    </button>
                    <button className="px-3 py-1 rounded-lg border border-slate-700 text-slate-200 disabled:opacity-60" disabled={isLoading}>
                        Stop
                    </button>
                </div>
            </div>
            {isLoading && <p className="text-sm text-slate-400">Loading preview…</p>}
            {hasError && <p className="text-sm text-rose-300">Preview failed.</p>}
            {!isLoading && !hasError && <WaveformBars bars={bars} />}
        </div>
    );
}
