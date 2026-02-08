import React from 'react';

interface EmptyStateProps {
    title: string;
    body: string;
    cta?: string;
    onCta?: () => void;
}

export default function EmptyState({ title, body, cta, onCta }: EmptyStateProps) {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-6 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-100">{title}</p>
            <p className="text-sm text-slate-400">{body}</p>
            {cta && (
                <button className="px-3 py-2 rounded-lg bg-accent text-slate-950 font-semibold text-sm" onClick={onCta}>
                    {cta}
                </button>
            )}
        </div>
    );
}
