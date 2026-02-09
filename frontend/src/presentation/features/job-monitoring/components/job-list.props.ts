/**
 * Job List component props
 */

import { JobStatusCardProps } from './job-status-card.props';

export interface JobListProps {
    readonly jobs: readonly Omit<JobStatusCardProps, 'onViewDetails' | 'onRetry'>[];
    readonly isLoading?: boolean;
    readonly onViewDetails?: (jobId: string) => void;
    readonly onRetry?: (jobId: string) => void;
    readonly emptyMessage?: string;
}
