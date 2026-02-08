import React from 'react';

interface FooterNavProps {
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
    helper: string;
}

export default function FooterNav({ onPrev, onNext, canPrev, canNext, helper }: FooterNavProps) {
    return (
        <div className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/80 px-4 py-3">
            <div className="text-xs text-slate-400">{helper}</div>
            <div className="flex items-center gap-2">
                <button
                    className="px-3 py-2 rounded-lg border border-slate-700 text-slate-100 hover:border-accent hover:text-accent disabled:opacity-50"
                    onClick={onPrev}
                    disabled={!canPrev}
                >
                    Previous
                </button>
                <button
                    className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-50"
                    onClick={onNext}
                    disabled={!canNext}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
