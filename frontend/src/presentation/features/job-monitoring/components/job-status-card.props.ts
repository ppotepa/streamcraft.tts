/**
 * Job Status Card component props
 */

export interface JobStatusCardProps {
    readonly jobId: string;
    readonly vodUrl: string;
    readonly status: 'idle' | 'running' | 'done' | 'error';
    readonly currentStep?: string;
    readonly progress?: number;
    readonly errorMessage?: string;
    readonly createdAt: string;
    readonly onViewDetails?: (jobId: string) => void;
    readonly onRetry?: (jobId: string) => void;
}
