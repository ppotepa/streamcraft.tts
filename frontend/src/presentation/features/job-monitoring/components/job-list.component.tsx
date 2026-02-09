/**
 * Job List component
 * Displays a list of jobs with their statuses
 */

import React from 'react';
import { JobListProps } from './job-list.props';
import { JobStatusCard } from './job-status-card.component';

export const JobList: React.FC<JobListProps> = ({
    jobs,
    isLoading = false,
    onViewDetails,
    onRetry,
    emptyMessage = 'No jobs found',
}) => {
    if (isLoading) {
        return (
            <div className="job-list-loading flex items-center justify-center py-12">
                <div className="text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm">Loading jobs...</p>
                </div>
            </div>
        );
    }

    if (jobs.length === 0) {
        return (
            <div className="job-list-empty flex items-center justify-center py-12">
                <p className="text-gray-500 text-sm">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="job-list grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
                <JobStatusCard
                    key={job.jobId}
                    {...job}
                    onViewDetails={onViewDetails}
                    onRetry={onRetry}
                />
            ))}
        </div>
    );
};
