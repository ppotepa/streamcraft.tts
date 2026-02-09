export type StepId = 'vod' | 'sanitize' | 'review' | 'srt' | 'train' | 'tts';

export type StepStatus = string;

export interface StepState {
    id: StepId;
    title: string;
    subtitle: string;
    status: StepStatus;
    ready: boolean;
    locked: boolean;
    message?: string;
    exitCode?: number;
    outputs?: { label: string; path: string }[];
}
