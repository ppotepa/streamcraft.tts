import React from 'react';
import { Job } from '../../api/client';
import { JobCard } from './JobCard';
import { EmptyJobs } from './EmptyJobs';

interface JobsListProps {
    jobs: Job[];
    onSelectJob: (job: Job) => void;
    onDeleteJob: (jobId: string) => void;
}

/**
 * List of job cards with empty state handling
 */
export function JobsList({ jobs, onSelectJob, onDeleteJob }: JobsListProps) {
    if (jobs.length === 0) {
        return <EmptyJobs />;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-300">Recent Jobs ({jobs.length})</p>
            </div>
            <div className="space-y-2">
                {jobs.map((job) => (
                    <JobCard key={job.id} job={job} onSelect={onSelectJob} onDelete={onDeleteJob} />
                ))}
            </div>
        </div>
    );
}
