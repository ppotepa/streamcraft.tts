import React from 'react';
import { Job } from '../../api/client';
import { JobCard } from './JobCard';
import { EmptyJobs } from './EmptyJobs';

interface JobsListProps {
    jobs: Job[];
    onSelectJob: (job: Job, startStep?: string) => void;
    onDeleteJob: (jobId: string) => void;
}

/**
 * List of job cards with empty state handling
 */
export function JobsList({ jobs, onSelectJob, onDeleteJob }: JobsListProps) {
    if (jobs.length === 0) {
        return <EmptyJobs />;
    }

    const grouped = jobs.reduce<Record<string, Job[]>>((acc, job) => {
        const key = job.streamer || 'unknown';
        acc[key] = acc[key] || [];
        acc[key].push(job);
        return acc;
    }, {});

    return (
        <div className="space-y-4">
            {Object.entries(grouped).map(([streamer, items]) => (
                <div key={streamer} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                        <span className="px-2 py-1 rounded bg-slate-800 text-slate-100 font-semibold text-xs">{streamer}</span>
                        <span className="text-slate-500 text-xs">{items.length} job{items.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="space-y-2">
                        {items.map((job) => (
                            <JobCard key={job.id} job={job} onSelect={onSelectJob} onDelete={onDeleteJob} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
