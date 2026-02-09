import React from 'react';
import { StepState } from '../state/types';
import StatusCard from './StatusCard';
import PathRow from './PathRow';
import DiffBanner from './DiffBanner';

interface AudioExtractSectionProps {
    vodQuality: string;
    onVodQualityChange: (quality: string) => void;
    audioStep: StepState;
    onExtract: () => void;
    onRerun: () => void;
    onShowToast: (message: string) => void;
    onViewLogs: () => void;
}

/**
 * Audio extraction section - appears after VOD metadata is validated
 * Includes quality selector, extract button, progress, and output path
 */
export default function AudioExtractSection({
    vodQuality,
    onVodQualityChange,
    audioStep,
    onExtract,
    onRerun,
    onShowToast,
    onViewLogs,
}: AudioExtractSectionProps): JSX.Element {
    const isRunning = audioStep.status === 'running';
    const isDone = audioStep.status === 'done';
    const hasError = audioStep.status === 'error';

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3 animate-[fadeIn_0.3s_ease-in_0.2s] opacity-0 [animation-fill-mode:forwards]">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-base font-semibold text-slate-100">Extract Audio</p>
                    <p className="text-xs text-slate-400">Choose quality and extract audio track from VOD</p>
                </div>
                {!isDone && (
                    <button
                        className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold disabled:opacity-60 disabled:cursor-not-allowed hover:bg-accent/90 transition"
                        onClick={onExtract}
                        disabled={isRunning}
                    >
                        {isRunning ? 'Extracting...' : 'Extract Audio'}
                    </button>
                )}
            </div>

            {/* Quality selector */}
            {!isDone && (
                <div className="space-y-2">
                    <label className="text-sm text-slate-200">Audio Quality</label>
                    <select
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
                        value={vodQuality}
                        onChange={(e) => onVodQualityChange(e.target.value)}
                        disabled={isRunning}
                    >
                        <option value="audio_only">Audio Only (recommended)</option>
                        <option value="best">Best Quality</option>
                        <option value="source">Source</option>
                        <option value="1080p60">1080p60</option>
                        <option value="1080p">1080p</option>
                        <option value="720p60">720p60</option>
                        <option value="720p">720p</option>
                        <option value="480p">480p</option>
                        <option value="360p">360p</option>
                        <option value="160p">160p</option>
                    </select>
                    <p className="text-xs text-slate-400">
                        Audio Only is fastest. Higher qualities extract audio from video stream.
                    </p>
                </div>
            )}

            {/* Status Card */}
            {(isRunning || isDone || hasError) && (
                <StatusCard step={audioStep} onViewLogs={onViewLogs} />
            )}

            {/* Error Banner */}
            {hasError && (
                <DiffBanner
                    message={audioStep.message || 'Audio extraction failed.'}
                    onRerun={onRerun}
                />
            )}

            {/* Output Paths */}
            {isDone && audioStep.outputs && audioStep.outputs.map((o) => (
                <PathRow
                    key={o.path}
                    label={o.label}
                    path={o.path}
                    onCopy={() => onShowToast('Copied path')}
                />
            ))}

            {/* Success State */}
            {isDone && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                    <div className="flex items-center gap-2 text-emerald-300">
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <div className="flex-1">
                            <p className="text-sm font-semibold">Audio extracted successfully</p>
                            <p className="text-xs text-emerald-400/80 mt-0.5">Ready to proceed to Sanitize step</p>
                        </div>
                        <button
                            className="px-3 py-1.5 rounded-lg border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/20 transition"
                            onClick={onRerun}
                        >
                            Re-extract
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
