import React from 'react';
import { StepState } from '../state/types';

interface SidebarProps {
    steps: StepState[];
    activeId: string;
    onSelect: (id: string) => void;
}

const statusIcon: Record<StepState['status'], string> = {
    idle: '○',
    running: '◐',
    done: '●',
    error: '⚠',
};

export default function Sidebar({ steps, activeId, onSelect }: SidebarProps) {
    return (
        <aside className="space-y-2">
            {steps.map((s, idx) => {
                const locked = s.locked && !s.ready;
                return (
                    <button
                        key={s.id}
                        className={`w-full text-left rounded-xl border border-slate-800 px-3 py-3 transition ${activeId === s.id ? 'bg-slate-900 text-slate-100' : 'bg-slate-950 text-slate-300'
                            } ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:border-accent hover:text-accent'}`}
                        onClick={() => !locked && onSelect(s.id)}
                        disabled={locked}
                    >
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">{statusIcon[s.status]}</span>
                                <span className="font-semibold">{idx + 1}. {s.title}</span>
                            </div>
                            {s.ready && <span className="text-[11px] uppercase text-emerald-300">Ready</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{s.subtitle}</p>
                    </button>
                );
            })}
        </aside>
    );
}
