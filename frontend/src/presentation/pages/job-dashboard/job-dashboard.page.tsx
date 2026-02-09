/**
 * Job Dashboard Page
 * Main page for monitoring and managing jobs
 */

import React, { useEffect, useState } from 'react';
import { JobList } from '../../features/job-monitoring';
import { Pagination } from '../../shared/pagination';
import { useDependencies } from '../../context/dependency-context';
import { useListJobs } from '../../shared/hooks/use-list-jobs';
import { Job } from '../../../domain/job/entities/job';

const ITEMS_PER_PAGE = 10;

export const JobDashboardPage: React.FC = () => {
    const container = useDependencies();
    const listJobsHandler = container.getListJobsHandler();
    const { data, isLoading, error, execute } = useListJobs(listJobsHandler, {
        autoFetch: true,
    });

    const [currentPage, setCurrentPage] = useState(1);
    const [paginatedJobs, setPaginatedJobs] = useState<Job[]>([]);
    const [totalPages, setTotalPages] = useState(1);

    // Update pagination when data changes
    useEffect(() => {
        if (data?.jobs) {
            const total = Math.ceil(data.jobs.length / ITEMS_PER_PAGE);
            setTotalPages(total);
            
            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
            const endIndex = startIndex + ITEMS_PER_PAGE;
            setPaginatedJobs(data.jobs.slice(startIndex, endIndex));
        }
    }, [data, currentPage]);

    const handleViewDetails = (jobId: string): void => {
        // Navigate to job details page
        console.log('View job details:', jobId);
    };

    const handleRetry = (jobId: string): void => {
        // Retry failed job
        console.log('Retry job:', jobId);
    };

    const handleRefresh = (): void => {
        setCurrentPage(1);
        execute();
    };

    const handlePageChange = (page: number): void => {
        setCurrentPage(page);
    };

    return (
        <div className="job-dashboard-page p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Job Dashboard</h1>
                    <button
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                    >
                        {isLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 text-sm">{error.message}</p>
                    </div>
                )}

                {data && (
                    <div className="mb-4 text-sm text-gray-600">
                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, data.jobs.length)} of {data.totalCount} jobs
                    </div>
                )}

                <JobList
                    jobs={paginatedJobs}
                    isLoading={isLoading}
                    onViewDetails={handleViewDetails}
                    onRetry={handleRetry}
                />

                {data && data.jobs.length > ITEMS_PER_PAGE && (
                    <div className="mt-6">
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={handlePageChange}
                            itemsPerPage={ITEMS_PER_PAGE}
                            totalItems={data.totalCount}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
