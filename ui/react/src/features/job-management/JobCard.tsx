import React from 'react';
import { Job } from '../../api/client';
import { StepId } from '../../state/types';
import { JobProgress } from './JobProgress';
import { formatJobDate, getLastStep, getProgressPercent, getStepStates } from './jobUtils';

interface JobCardProps {
    job: Job;
    onSelect: (job: Job, startStep?: StepId) => void;
    onDelete: (jobId: string) => void;
}

/**
 * Individual job card with metadata, progress, and actions
 */
export function JobCard({ job, onSelect, onDelete }: JobCardProps) {
    const lastStep = getLastStep(job);
    const progress = getProgressPercent(job);
    const stepStates = getStepStates(job);
    const completedSteps = Object.values(job.steps).filter(Boolean).length;
    const [startStep, setStartStep] = React.useState<StepId | 'auto'>('auto');
    const stepOrder: StepId[] = ['vod', 'sanitize', 'review', 'srt', 'train', 'tts'];

    return (
        <div
            className="w-full text-left rounded-xl border border-slate-800 bg-slate-900/60 hover:border-accent hover:bg-slate-900 p-4 transition group cursor-pointer"
            onClick={() => onSelect(job, startStep === 'auto' ? undefined : startStep)}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-slate-100 truncate">{job.streamer}</p>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                            {lastStep}
                        </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mb-2">{job.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <span>Updated {formatJobDate(job.updatedAt)}</span>
                        <span>·</span>
                        <span>
                            {completedSteps}/5 steps
                        </span>
                    </div>
                    <JobProgress progress={progress} stepStates={stepStates} />
                </div>
                <button
                    className="px-2 py-1 rounded text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(job.id);
                    }}
                >
                    Delete
                </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                <span className="text-slate-500">Start at:</span>
                <select
                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200"
                    value={startStep}
                    onChange={(e) => setStartStep(e.target.value as StepId | 'auto')}
                    onClick={(e) => e.stopPropagation()}
                >
                    <option value="auto">Auto (next step)</option>
                    {stepOrder.map((step) => (
                        <option key={step} value={step}>
                            {step.toUpperCase()}
                        </option>
                    ))}
                </select>
                <button
                    className="px-2 py-1 rounded border border-slate-700 text-slate-200 hover:border-accent hover:text-accent"
                    onClick={(e) => {
                        e.stopPropagation();
                        onSelect(job, startStep === 'auto' ? undefined : startStep);
                    }}
                >
                    Resume
                </button>
            </div>
        </div>
    );
}
