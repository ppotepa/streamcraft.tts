import React from 'react';

interface DiffBannerProps {
    message: string;
    onRerun?: () => void;
}

export default function DiffBanner({ message, onRerun }: DiffBannerProps) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-100">
            <div className="flex items-center gap-2 text-sm">
                <span className="text-lg">⚠</span>
                <span>{message}</span>
            </div>
            <button className="text-xs px-3 py-1 rounded border border-amber-400 text-amber-50 hover:bg-amber-400 hover:text-slate-900" onClick={onRerun}>
                Re-run
            </button>
        </div>
    );
}
