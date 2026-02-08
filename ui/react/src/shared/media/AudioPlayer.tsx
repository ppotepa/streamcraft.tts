import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

export type AudioPlayerMode = 'small' | 'compact' | 'full';

export interface AudioSegment {
    start: number; // seconds
    end: number; // seconds
    label?: string;
}

interface AudioPlayerProps {
    audioSrc?: string;
    mode?: AudioPlayerMode;
    segment?: AudioSegment; // If provided, plays only this segment
    playlist?: AudioSegment[]; // If provided, plays segments in sequence
    autoPlay?: boolean;
    playToken?: number; // increment to force playback restart
    onSegmentEnd?: () => void;
    onPlaylistEnd?: () => void;
    highlightSegment?: AudioSegment; // highlighted range overlay
    className?: string;
}

export default function AudioPlayer({
    audioSrc,
    mode = 'compact',
    segment,
    playlist,
    autoPlay = false,
    playToken,
    onSegmentEnd,
    onPlaylistEnd,
    highlightSegment,
    className = '',
}: AudioPlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);

    const activeSegmentRef = useRef<AudioSegment | undefined>(undefined);
    const lastPlayTokenRef = useRef<number | undefined>(undefined);
    const playlistRef = useRef<AudioSegment[] | undefined>(playlist ?? undefined);
    const segmentIndexRef = useRef<number>(0);

    const activeSegment = segment || (playlist && playlist[currentSegmentIndex]);
    activeSegmentRef.current = activeSegment;
    playlistRef.current = playlist ?? undefined;
    segmentIndexRef.current = currentSegmentIndex;

    // Initialize WaveSurfer
    useEffect(() => {
        if (!containerRef.current || !audioSrc) return;

        const wavesurfer = WaveSurfer.create({
            container: containerRef.current,
            waveColor: mode === 'small' ? '#64748b' : '#475569',
            progressColor: mode === 'small' ? '#06b6d4' : '#0ea5e9',
            cursorColor: '#0ea5e9',
            barWidth: mode === 'small' ? 1 : 2,
            barGap: mode === 'small' ? 1 : 2,
            barRadius: 2,
            height: mode === 'small' ? 32 : mode === 'compact' ? 64 : 128,
            normalize: true,
            backend: 'WebAudio',
        });

        wavesurferRef.current = wavesurfer;

        const handleReady = () => {
            setDuration(wavesurfer.getDuration());
            setIsLoading(false);
            setError(null);
            if (autoPlay || lastPlayTokenRef.current !== undefined) {
                playSegment();
            }
        };

        wavesurfer.on('ready', handleReady);
        wavesurfer.on('play', () => setIsPlaying(true));
        wavesurfer.on('pause', () => setIsPlaying(false));

        wavesurfer.on('audioprocess', (time) => {
            setCurrentTime(time);

            const seg = activeSegmentRef.current;
            const playlistCurrent = playlistRef.current;
            const idx = segmentIndexRef.current;
            if (seg && time >= seg.end - 0.01) {
                wavesurfer.pause();
                setIsPlaying(false);

                if (playlistCurrent && idx < playlistCurrent.length - 1) {
                    setCurrentSegmentIndex((i) => i + 1);
                } else if (playlistCurrent && idx === playlistCurrent.length - 1) {
                    onPlaylistEnd?.();
                }
                onSegmentEnd?.();
            }
        });

        wavesurfer.on('error', (err) => {
            console.error('WaveSurfer error:', err);
            setError('Failed to load audio');
            setIsLoading(false);
        });

        setIsLoading(true);
        setError(null);
        wavesurfer.load(audioSrc);

        return () => {
            wavesurfer.destroy();
            wavesurferRef.current = null;
        };
    }, [audioSrc, mode]);

    // Jump to the active segment when it changes (only position, no auto-play)
    useEffect(() => {
        const ws = wavesurferRef.current;
        const seg = activeSegmentRef.current;
        if (!ws) return;

        if (seg) {
            ws.setTime(seg.start);
        } else {
            ws.setTime(0);
        }
    }, [segment?.start, segment?.end, playlist, currentSegmentIndex]);

    // Explicit play trigger (used by review screen when moving between segments)
    useEffect(() => {
        if (playToken === undefined) return;
        if (lastPlayTokenRef.current === playToken) return;
        lastPlayTokenRef.current = playToken;
        playSegment();
    }, [playToken]);

    // Play next segment when index changes
    useEffect(() => {
        if (playlist && currentSegmentIndex > 0 && wavesurferRef.current) {
            playSegment();
        }
    }, [currentSegmentIndex]);

    const playSegment = () => {
        const ws = wavesurferRef.current;
        if (!ws) return;

        const seg = activeSegmentRef.current;
        ws.pause();
        if (seg) {
            ws.setTime(seg.start);
        } else {
            ws.setTime(0);
        }
        ws.play();
    };

    const handlePlayPause = () => {
        const ws = wavesurferRef.current;
        if (!ws) return;

        if (isPlaying) {
            ws.pause();
        } else {
            playSegment();
        }
    };

    const handleStop = () => {
        const ws = wavesurferRef.current;
        if (!ws) return;

        ws.pause();
        if (activeSegment) {
            ws.setTime(activeSegment.start);
        } else {
            ws.setTime(0);
        }
        setCurrentSegmentIndex(0);
    };

    const handleSkipNext = () => {
        if (playlist && currentSegmentIndex < playlist.length - 1) {
            setCurrentSegmentIndex((i) => i + 1);
        }
    };

    const handleSkipPrev = () => {
        if (playlist && currentSegmentIndex > 0) {
            setCurrentSegmentIndex((i) => i - 1);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (!audioSrc) {
        return (
            <div className={`rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-center ${className}`}>
                <p className="text-sm text-slate-400">No audio source</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`rounded-lg border border-rose-800 bg-rose-900/20 p-4 text-center ${className}`}>
                <p className="text-sm text-rose-300">{error}</p>
            </div>
        );
    }

    return (
        <div className={`rounded-lg border border-slate-800 bg-slate-900/80 ${className}`}>
            {/* Header - only in compact/full modes */}
            {mode !== 'small' && (
                <div className="px-4 pt-3 pb-2 border-b border-slate-800">
                    <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-100 truncate">
                                {activeSegment?.label || 'Audio Player'}
                            </p>
                            {playlist && (
                                <p className="text-xs text-slate-400">
                                    Segment {currentSegmentIndex + 1} / {playlist.length}
                                </p>
                            )}
                        </div>
                        <div className="text-xs text-slate-400 tabular-nums">
                            {formatTime(activeSegment ? currentTime - activeSegment.start : currentTime)} / {formatTime(activeSegment ? activeSegment.end - activeSegment.start : duration)}
                        </div>
                    </div>
                </div>
            )}

            {/* Waveform */}
            <div className="relative">
                <div ref={containerRef} className="w-full" />
                {highlightSegment && duration > 0 && (
                    <div
                        className="pointer-events-none absolute inset-y-0 bg-white/10 ring-2 ring-white/70 shadow-[0_0_0_2px_rgba(255,255,255,0.35)]"
                        style={{
                            left: `${Math.max(0, (highlightSegment.start / duration) * 100)}%`,
                            width: `${Math.max(1, ((highlightSegment.end - highlightSegment.start) / duration) * 100)}%`,
                        }}
                    />
                )}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
                        <div className="flex items-center gap-2 text-slate-300">
                            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs">Loading audio...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className={`flex items-center gap-2 ${mode === 'small' ? 'px-2 py-1' : 'px-4 py-3'} border-t border-slate-800`}>
                {/* Playlist navigation - only if playlist exists */}
                {playlist && (
                    <button
                        className="p-1 rounded text-slate-300 hover:text-sky-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={handleSkipPrev}
                        disabled={currentSegmentIndex === 0}
                        title="Previous segment"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8.445 14.832A1 1 0 0010 14v-2.798l5.445 3.63A1 1 0 0017 14V6a1 1 0 00-1.555-.832L10 8.798V6a1 1 0 00-1.555-.832l-6 4a1 1 0 000 1.664l6 4z" />
                        </svg>
                    </button>
                )}

                {/* Play/Pause */}
                <button
                    className={`${mode === 'small' ? 'p-1' : 'p-2'} rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 transition disabled:opacity-50`}
                    onClick={handlePlayPause}
                    disabled={isLoading}
                >
                    {isPlaying ? (
                        <svg className={`${mode === 'small' ? 'w-3 h-3' : 'w-4 h-4'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg className={`${mode === 'small' ? 'w-3 h-3' : 'w-4 h-4'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                    )}
                </button>

                {/* Stop */}
                <button
                    className={`${mode === 'small' ? 'p-1' : 'p-2'} rounded text-slate-300 hover:text-sky-400 hover:bg-slate-800 transition`}
                    onClick={handleStop}
                    title="Stop"
                >
                    <svg className={`${mode === 'small' ? 'w-3 h-3' : 'w-4 h-4'}`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                </button>

                {/* Next - only if playlist exists */}
                {playlist && (
                    <button
                        className="p-1 rounded text-slate-300 hover:text-sky-400 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={handleSkipNext}
                        disabled={currentSegmentIndex === playlist.length - 1}
                        title="Next segment"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l6-4a1 1 0 000-1.664l-6-4A1 1 0 0010 6v2.798l-5.445-3.63z" />
                        </svg>
                    </button>
                )}

                {/* Time display - only in small mode */}
                {mode === 'small' && (
                    <div className="ml-auto text-[10px] text-slate-400 tabular-nums">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                )}
            </div>
        </div>
    );
}
