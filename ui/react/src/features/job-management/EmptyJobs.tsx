import React from 'react';

/**
 * Empty state shown when no jobs exist
 */
export function EmptyJobs() {
    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            <p className="text-slate-400 text-sm">No jobs yet. Start by checking a new VOD.</p>
        </div>
    );
}
