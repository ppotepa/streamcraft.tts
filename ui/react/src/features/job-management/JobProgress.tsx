import React from 'react';

interface JobProgressProps {
    progress: number;
    stepStates: Array<{ key: string; completed: boolean }>;
}

/**
 * Progress bar with step completion indicators
 */
export function JobProgress({ progress, stepStates }: JobProgressProps) {
    return (
        <>
            <div className="mt-2 h-1 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-1 mt-3">
                {stepStates.map(({ key, completed }) => (
                    <div
                        key={key}
                        className={`flex-1 h-1 rounded-full transition-colors ${completed ? 'bg-emerald-500' : 'bg-slate-800'
                            }`}
                        title={`${key}: ${completed ? 'Done' : 'Pending'}`}
                    />
                ))}
            </div>
        </>
    );
}
