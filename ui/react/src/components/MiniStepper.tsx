import React from 'react';
import { StepState } from '../state/types';

interface MiniStepperProps {
    steps: StepState[];
    activeId: string;
    onSelect: (id: string) => void;
}

const statusDot: Record<StepState['status'], string> = {
    idle: 'bg-slate-600',
    running: 'bg-amber-500',
    done: 'bg-emerald-500',
    error: 'bg-rose-500',
};

export default function MiniStepper({ steps, activeId, onSelect }: MiniStepperProps) {
    return (
        <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
            {steps.map((s) => {
                const locked = s.locked && !s.ready;
                return (
                    <button
                        key={s.id}
                        className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs transition ${activeId === s.id ? 'bg-slate-800 text-slate-100' : 'text-slate-300'
                            } ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'}`}
                        onClick={() => !locked && onSelect(s.id)}
                        disabled={locked}
                    >
                        <span className={`h-2 w-2 rounded-full ${statusDot[s.status]}`}></span>
                        <span className="uppercase tracking-wide">{s.title}</span>
                    </button>
                );
            })}
        </div>
    );
}
