import React from 'react';
import { StepState } from '../../state/types';
import PathRow from '../forms/PathRow';

interface StatusCardProps {
    step: StepState;
}

const statusColor: Record<StepState['status'], string> = {
    idle: 'bg-slate-800',
    running: 'bg-amber-500',
    done: 'bg-emerald-500',
    error: 'bg-rose-500',
};

const statusLabel: Record<StepState['status'], string> = {
    idle: 'Idle',
    running: 'Running',
    done: 'Done',
    error: 'Error',
};

export default function StatusCard({ step }: StatusCardProps) {
    const pct = step.status === 'running' ? 60 : step.status === 'done' || step.status === 'error' ? 100 : 0;

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 shadow">
            <div className="flex items-center gap-2 text-sm text-slate-300 px-4 py-3 border-b border-slate-800">
                <div className={`h-2 w-2 rounded-full ${statusColor[step.status]}`}></div>
                <span className="font-semibold text-slate-100">{statusLabel[step.status]}</span>
                {step.ready && <span className="px-2 py-0.5 text-[11px] uppercase rounded-full border border-emerald-500/60 text-emerald-300">Ready</span>}
                {typeof step.exitCode === 'number' && (
                    <span className="px-2 py-0.5 text-[11px] uppercase rounded-full border border-slate-700 text-slate-200">Exit {step.exitCode}</span>
                )}
            </div>
            <div className="px-4 py-3 space-y-3">
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                </div>
                {step.message && <p className="text-sm text-slate-300">{step.message}</p>}
                {step.outputs && step.outputs.length > 0 && (
                    <div className="space-y-2">
                        {step.outputs.map((o) => (
                            <PathRow key={o.path} label={o.label} path={o.path} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
