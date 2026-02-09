/**
 * Job Status Card component
 * Displays job status and progress information
 */

import React from 'react';
import { JobStatusCardProps } from './job-status-card.props';

export const JobStatusCard: React.FC<JobStatusCardProps> = ({
    jobId,
    vodUrl,
    status,
    currentStep,
    progress,
    errorMessage,
    createdAt,
    onViewDetails,
    onRetry,
}) => {
    const getStatusColor = (): string => {
        switch (status) {
            case 'idle':
                return 'bg-gray-100 text-gray-800';
            case 'running':
                return 'bg-blue-100 text-blue-800';
            case 'done':
                return 'bg-green-100 text-green-800';
            case 'error':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusIcon = (): string => {
        switch (status) {
            case 'idle':
                return '⏸️';
            case 'running':
                return '▶️';
            case 'done':
                return '✅';
            case 'error':
                return '❌';
            default:
                return '❓';
        }
    };

    const formatDate = (isoString: string): string => {
        return new Date(isoString).toLocaleString();
    };

    const handleViewDetails = (): void => {
        if (onViewDetails) {
            onViewDetails(jobId);
        }
    };

    const handleRetry = (): void => {
        if (onRetry) {
            onRetry(jobId);
        }
    };

    return (
        <div className="job-status-card border rounded-lg p-4 shadow-sm bg-white">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor()}`}>
                            {getStatusIcon()} {status.toUpperCase()}
                        </span>
                        {progress !== undefined && (
                            <span className="text-xs text-gray-500">{progress}%</span>
                        )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1 truncate">
                        {vodUrl}
                    </p>
                    <p className="text-xs text-gray-500 font-mono">{jobId}</p>
                </div>
            </div>

            {currentStep && (
                <div className="mb-3">
                    <p className="text-sm text-gray-700">
                        <span className="font-medium">Current step:</span> {currentStep}
                    </p>
                </div>
            )}

            {progress !== undefined && (
                <div className="mb-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            {errorMessage && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs text-red-700">{errorMessage}</p>
                </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>Created: {formatDate(createdAt)}</span>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={handleViewDetails}
                    className="flex-1 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
                >
                    View Details
                </button>
                {status === 'error' && onRetry && (
                    <button
                        onClick={handleRetry}
                        className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                    >
                        Retry
                    </button>
                )}
            </div>
        </div>
    );
};
