/**
 * Job Details Page
 * Displays comprehensive information about a specific job
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDependencies } from '../../context/dependency-context';
import { useToast } from '../../shared/toast';
import { Job } from '../../../domain/job/entities/job';
import { Result } from '../../../domain/shared/result';

export const JobDetailsPage = () => {
    const { jobId } = useParams<{ jobId: string }>();
    const navigate = useNavigate();
    const { getGetJobStatusHandler } = useDependencies();
    const { showToast } = useToast();

    const [job, setJob] = useState<Job | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!jobId) return;

        const fetchJob = async () => {
            setLoading(true);
            setError(null);

            const handler = getGetJobStatusHandler();
            const result: Result<any, Error> = await handler.execute({ jobId });

            if (result.isOk()) {
                // The handler returns a DTO, we'd need to convert it to Job entity
                // For now, just use the DTO directly
                setJob(result.value as Job);
                setError(null);
            } else {
                const errorMsg = result.error.message;
                setError(errorMsg);
                showToast('error', `Failed to load job: ${errorMsg}`);
            }

            setLoading(false);
        };

        fetchJob();
    }, [jobId, getGetJobStatusHandler]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-gray-500">Loading job details...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
                <p className="text-red-600">{error}</p>
                <button
                    onClick={() => navigate('/jobs')}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                    Back to Jobs
                </button>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-800">Job not found</p>
                <button
                    onClick={() => navigate('/jobs')}
                    className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                >
                    Back to Jobs
                </button>
            </div>
        );
    }

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'done':
                return 'text-green-700 bg-green-100';
            case 'running':
                return 'text-blue-700 bg-blue-100';
            case 'error':
                return 'text-red-700 bg-red-100';
            default:
                return 'text-gray-700 bg-gray-100';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/jobs')}
                    className="text-blue-600 hover:text-blue-700 flex items-center"
                >
                    <span className="mr-2">←</span>
                    Back to Jobs
                </button>

                <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        job.status.kind
                    )}`}
                >
                    {job.status.kind.toUpperCase()}
                </span>
            </div>

            {/* Job Info Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Job Details</h1>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500">Job ID</label>
                        <p className="text-gray-900 font-mono">{job.jobId}</p>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-500">VOD URL</label>
                        <p className="text-gray-900 truncate">{job.vodUrl}</p>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-500">Created At</label>
                        <p className="text-gray-900">{job.createdAt.toLocaleString()}</p>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-500">Updated At</label>
                        <p className="text-gray-900">{job.updatedAt.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Status Card */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Status</h2>

                {job.status.kind === 'running' && job.status.currentStep && (
                    <div className="mb-4">
                        <label className="text-sm font-medium text-gray-500">Current Step</label>
                        <p className="text-gray-900">{job.status.currentStep}</p>
                    </div>
                )}

                {job.status.kind === 'running' && job.status.progress !== undefined && (
                    <div className="mb-4">
                        <label className="text-sm font-medium text-gray-500 mb-2 block">
                            Progress
                        </label>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                            <div
                                className="bg-blue-600 h-4 rounded-full transition-all"
                                style={{ width: `${job.status.progress * 100}%` }}
                            />
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                            {Math.round(job.status.progress * 100)}%
                        </p>
                    </div>
                )}

                {job.status.kind === 'error' && job.status.errorMessage && (
                    <div className="bg-red-50 border border-red-200 rounded p-4">
                        <label className="text-sm font-medium text-red-700 block mb-2">
                            Error Message
                        </label>
                        <pre className="text-sm text-red-800 whitespace-pre-wrap">
                            {job.status.errorMessage}
                        </pre>
                    </div>
                )}
            </div>

            {/* Actions */}
            {job.status.kind === 'error' && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Actions</h2>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        Retry Job
                    </button>
                </div>
            )}
        </div>
    );
};
