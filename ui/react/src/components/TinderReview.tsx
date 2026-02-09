import React, { useEffect, useRef, useState, useMemo } from 'react';

interface Segment {
    index?: number;
    start: number;
    end: number;
    duration?: number;
    rmsDb?: number;
    kept?: boolean;
}

interface TinderReviewProps {
    segments: Segment[];
    audioSrc?: string;
    trackType?: 'direct' | 'vocal';
    onClose: () => void;
    onComplete: (votes: Record<number, 'accept' | 'reject'>) => void;
}

type Vote = 'accept' | 'reject';
type FlashType = 'accept' | 'reject' | null;

/**
 * Tinder-style segment review interface
 * Keyboard controls: Enter=Accept, Space=Reject, R=Replay, Escape=Exit
 */
export default function TinderReview({ segments, audioSrc, trackType = 'direct', onClose, onComplete }: TinderReviewProps) {
    const [currentIdx, setCurrentIdx] = useState(0);
    const [votes, setVotes] = useState<Record<number, Vote>>({});
    const [flash, setFlash] = useState<FlashType>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const normalizedSegments = useMemo(() =>
        segments.map((s, i) => ({
            ...s,
            index: s.index ?? i,
            duration: s.duration ?? Math.max(0, s.end - s.start),
        })),
        [segments]
    );

    const current = normalizedSegments[currentIdx];
    const acceptedSegments = normalizedSegments.filter(s => votes[s.index!] === 'accept');
    const progress = Math.round(((currentIdx + 1) / normalizedSegments.length) * 100);
    const acceptedCount = Object.values(votes).filter(v => v === 'accept').length;
    const rejectedCount = Object.values(votes).filter(v => v === 'reject').length;

    // Auto-play current clip when it changes
    useEffect(() => {
        if (!current || !audioSrc) return;
        playCurrentClip();
    }, [currentIdx, audioSrc]);

    const playCurrentClip = () => {
        if (!current || !audioRef.current) return;

        setIsLoading(true);
        const audio = audioRef.current;
        audio.currentTime = current.start;

        const handleCanPlay = () => {
            setIsLoading(false);
            audio.play().catch(err => console.error('Playback failed:', err));
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleEnded = () => setIsPlaying(false);

        const handleTimeUpdate = () => {
            // Stop at segment end
            if (audio.currentTime >= current.end) {
                audio.pause();
                audio.currentTime = current.start;
            }
        };

        audio.addEventListener('canplay', handleCanPlay, { once: true });
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('timeupdate', handleTimeUpdate);

        audio.load();

        return () => {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
        };
    };

    const triggerFlash = (type: FlashType) => {
        setFlash(type);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = setTimeout(() => setFlash(null), 300);
    };

    const handleAccept = () => {
        if (!current) return;
        setVotes(prev => ({ ...prev, [current.index!]: 'accept' }));
        triggerFlash('accept');
        advanceToNext();
    };

    const handleReject = () => {
        if (!current) return;
        setVotes(prev => ({ ...prev, [current.index!]: 'reject' }));
        triggerFlash('reject');
        advanceToNext();
    };

    const handleReplay = () => {
        playCurrentClip();
    };

    const advanceToNext = () => {
        setTimeout(() => {
            if (currentIdx < normalizedSegments.length - 1) {
                setCurrentIdx(prev => prev + 1);
            } else {
                // Review complete
                onComplete(votes);
            }
        }, 350);
    };

    const handleEscape = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        onClose();
    };

    const jumpToClip = (segmentIdx: number) => {
        const idx = normalizedSegments.findIndex(s => s.index === segmentIdx);
        if (idx >= 0) setCurrentIdx(idx);
    };

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleAccept();
            } else if (e.key === ' ') {
                e.preventDefault();
                handleReject();
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                handleReplay();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleEscape();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIdx, current, votes]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!current) {
        return (
            <div className="fixed inset-0 bg-slate-950/95 backdrop-blur z-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-xl font-semibold text-slate-100 mb-4">Review Complete!</p>
                    <div className="space-y-2 text-sm text-slate-400 mb-6">
                        <p>{acceptedCount} accepted</p>
                        <p>{rejectedCount} rejected</p>
                    </div>
                    <button
                        className="px-6 py-3 rounded-lg bg-accent text-slate-950 font-semibold hover:bg-accent/90"
                        onClick={handleEscape}
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`fixed inset-0 bg-slate-950/95 backdrop-blur z-50 flex transition-all duration-300 ${flash === 'accept' ? 'bg-emerald-500/20' : flash === 'reject' ? 'bg-rose-500/20' : ''
            }`}>
            {/* Hidden audio element */}
            {audioSrc && <audio ref={audioRef} src={audioSrc} preload="auto" />}

            {/* Top bar */}
            <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 text-sm font-semibold">
                        {currentIdx + 1} / {normalizedSegments.length}
                    </span>
                    <span className="text-xs text-slate-400">{progress}% complete</span>
                    {trackType && (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${trackType === 'vocal'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}>
                            {trackType === 'vocal' ? '🎤 Vocal Track' : '🔊 Direct Audio'}
                        </span>
                    )}
                </div>
                <button
                    className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100 transition"
                    onClick={handleEscape}
                >
                    Exit (Esc)
                </button>
            </div>

            {/* Main content area */}
            <div className="flex-1 flex items-center justify-center px-6 pb-20 pt-24">
                <div className="w-full max-w-4xl">
                    {/* Current clip display */}
                    <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-8 mb-6 shadow-2xl">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 mb-4">
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                        <span className="text-sm text-slate-300">Loading clip...</span>
                                    </div>
                                ) : isPlaying ? (
                                    <>
                                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                        <span className="text-sm text-slate-300">Playing</span>
                                    </>
                                ) : (
                                    <span className="text-sm text-slate-400">Ready</span>
                                )}
                            </div>

                            <p className="text-2xl font-bold text-slate-100 mb-2">
                                Segment {current.index! + 1}
                            </p>
                            <p className="text-sm text-slate-400">
                                {formatTime(current.start)} → {formatTime(current.end)} ({current.duration?.toFixed(2)}s)
                            </p>
                            {current.rmsDb && (
                                <p className="text-xs text-slate-500 mt-1">RMS: {current.rmsDb.toFixed(1)} dB</p>
                            )}
                        </div>

                        {/* Waveform placeholder */}
                        <div className="h-32 rounded-lg bg-slate-800 flex items-center justify-center mb-6">
                            <span className="text-sm text-slate-500">Audio Waveform</span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-center gap-4">
                            <button
                                className="px-8 py-4 rounded-xl bg-rose-500/20 border-2 border-rose-500/50 text-rose-300 font-bold text-lg hover:bg-rose-500/30 hover:border-rose-500 transition shadow-lg"
                                onClick={handleReject}
                            >
                                Reject (Space)
                            </button>
                            <button
                                className="px-6 py-3 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100 transition"
                                onClick={handleReplay}
                            >
                                Replay (R)
                            </button>
                            <button
                                className="px-8 py-4 rounded-xl bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-300 font-bold text-lg hover:bg-emerald-500/30 hover:border-emerald-500 transition shadow-lg"
                                onClick={handleAccept}
                            >
                                Accept (Enter)
                            </button>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-accent to-cyan-400 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Accepted clips sidebar */}
            {acceptedSegments.length > 0 && (
                <div className="w-80 border-l border-slate-800 bg-slate-900/60 p-4 overflow-y-auto">
                    <div className="mb-4">
                        <p className="text-sm font-semibold text-slate-200 mb-1">Accepted Clips</p>
                        <p className="text-xs text-slate-500">{acceptedSegments.length} segments</p>
                    </div>
                    <div className="space-y-2">
                        {acceptedSegments.map(seg => (
                            <button
                                key={seg.index}
                                onClick={() => jumpToClip(seg.index!)}
                                className="w-full text-left p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span className="text-sm font-medium text-slate-200">Segment {seg.index! + 1}</span>
                                </div>
                                <p className="text-xs text-slate-400">{formatTime(seg.start)} - {formatTime(seg.end)}</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
