import { Job } from '../../api/client';

/**
 * Format relative time display for job timestamps
 */
export function formatJobDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

/**
 * Get the last completed step name
 */
export function getLastStep(job: Job): string {
    if (job.steps.tts) return 'TTS';
    if (job.steps.srt) return 'SRT';
    if (job.steps.sanitize) return 'Sanitize';
    if (job.steps.audio) return 'Audio';
    if (job.steps.vod) return 'VOD';
    return 'Not started';
}

/**
 * Calculate overall progress percentage (0-100)
 */
export function getProgressPercent(job: Job): number {
    const completed = Object.values(job.steps).filter(Boolean).length;
    return (completed / 5) * 100;
}

/**
 * Get array of step completion states for indicators
 */
export function getStepStates(job: Job): Array<{ key: string; completed: boolean }> {
    return (['vod', 'audio', 'sanitize', 'srt', 'tts'] as const).map((step) => ({
        key: step,
        completed: !!job.steps[step],
    }));
}
