import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type SetSourceOptions = {
    autoplay?: boolean;
    label?: string;
    startAt?: number;
    endAt?: number;
};

const PLAYER_WAVEFORM_BARS = 180;

const condenseSamples = (values: ArrayLike<number>, bucketCount = PLAYER_WAVEFORM_BARS): number[] => {
    if (!values || values.length === 0) return [];
    const sliceSize = Math.max(1, Math.floor(values.length / bucketCount));
    const peaks: number[] = [];
    for (let i = 0; i < bucketCount; i++) {
        const start = i * sliceSize;
        if (start >= values.length) {
            peaks.push(0);
            continue;
        }
        const end = i === bucketCount - 1 ? values.length : Math.min(values.length, start + sliceSize);
        let max = 0;
        for (let j = start; j < end; j++) {
            const sample = Math.abs(values[j]);
            if (sample > max) max = sample;
        }
        peaks.push(max);
    }
    const maxPeak = Math.max(...peaks) || 1;
    return peaks.map((peak) => (maxPeak === 0 ? 0 : peak / maxPeak));
};

const fallbackPeaks = (seed: string, size = PLAYER_WAVEFORM_BARS): number[] => {
    const result: number[] = [];
    let x = Math.max(1, seed.length * 31);
    for (let i = 0; i < size; i++) {
        x = (x * 9301 + 49297) % 233280;
        const value = 0.16 + (x / 233280) * 0.72;
        result.push(Math.min(1, Math.max(0.06, value)));
    }
    return result;
};

export type PlaybackContext = 'sanitize' | 'review' | 'timeline' | 'generic';

export type AudioPlaylistItem = {
    id: number;
    src: string;
    label: string;
    startAt?: number;
    endAt?: number;
};

type PlaySegmentOptions = {
    context: PlaybackContext;
    playlist: AudioPlaylistItem[];
    segmentId: number;
    startAt?: number;
    endAt?: number;
    autoplay?: boolean;
};

type AudioPlayerContextValue = {
    src: string | null;
    label: string;
    isPlaying: boolean;
    duration: number;
    currentTime: number;
    playbackRate: number;
    playbackContext: PlaybackContext;
    playlist: AudioPlaylistItem[];
    currentSegmentId: number | null;
    autoplay: boolean;
    isMinimized: boolean;
    setSource: (src: string, options?: SetSourceOptions) => Promise<void>;
    playSegment: (options: PlaySegmentOptions) => Promise<void>;
    play: () => Promise<void>;
    pause: () => void;
    toggle: () => Promise<void>;
    seek: (time: number) => void;
    setPlaybackRate: (rate: number) => void;
    next: () => Promise<void>;
    previous: () => Promise<void>;
    setAutoplay: (enabled: boolean) => void;
    setMinimized: (value: boolean) => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const clipEndRef = useRef<number | null>(null);
    const waveformCacheRef = useRef<Record<string, number[]>>({});
    const waveformAbortRef = useRef<AbortController | null>(null);
    const waveformAudioContextRef = useRef<AudioContext | null>(null);
    const [src, setSrc] = useState<string | null>(null);
    const [label, setLabel] = useState('Global player');
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [playbackRate, setPlaybackRateState] = useState(1);
    const [playbackContext, setPlaybackContext] = useState<PlaybackContext>('generic');
    const [playlist, setPlaylist] = useState<AudioPlaylistItem[]>([]);
    const [currentSegmentId, setCurrentSegmentId] = useState<number | null>(null);
    const [autoplay, setAutoplay] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [position, setPosition] = useState({ x: 14, y: 14 });
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
    const [waveformLoading, setWaveformLoading] = useState(false);

    const clampPosition = useCallback((x: number, y: number) => {
        if (typeof window === 'undefined') {
            return { x, y };
        }
        const width = isMinimized ? 220 : isExpanded ? 820 : 420;
        const height = isMinimized ? 56 : isExpanded ? 430 : 270;
        return {
            x: Math.max(8, Math.min(x, window.innerWidth - width - 8)),
            y: Math.max(8, Math.min(y, window.innerHeight - height - 8)),
        };
    }, [isExpanded, isMinimized]);

    useEffect(() => {
        if (!src || typeof window === 'undefined') {
            setWaveformPeaks([]);
            setWaveformLoading(false);
            return;
        }

        const cached = waveformCacheRef.current[src];
        if (cached?.length) {
            setWaveformPeaks(cached);
            setWaveformLoading(false);
            return;
        }

        waveformAbortRef.current?.abort();
        const controller = new AbortController();
        waveformAbortRef.current = controller;
        setWaveformLoading(true);

        const loadWaveform = async () => {
            try {
                const response = await fetch(src, { signal: controller.signal });
                if (!response.ok) {
                    throw new Error('Unable to fetch waveform source');
                }
                const arrayBuffer = await response.arrayBuffer();

                if (!waveformAudioContextRef.current) {
                    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                    if (!Ctx) {
                        throw new Error('AudioContext not supported');
                    }
                    waveformAudioContextRef.current = new Ctx();
                }

                const audioBuffer = await waveformAudioContextRef.current.decodeAudioData(arrayBuffer);
                const channelData = audioBuffer.numberOfChannels > 0
                    ? audioBuffer.getChannelData(0)
                    : new Float32Array();
                const peaks = condenseSamples(channelData);
                const normalized = peaks.length ? peaks : fallbackPeaks(src);

                waveformCacheRef.current[src] = normalized;
                setWaveformPeaks(normalized);
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    const fallback = fallbackPeaks(src);
                    waveformCacheRef.current[src] = fallback;
                    setWaveformPeaks(fallback);
                }
            } finally {
                setWaveformLoading(false);
            }
        };

        void loadWaveform();

        return () => {
            controller.abort();
        };
    }, [src]);

    const playByIndex = useCallback(async (index: number, startAt?: number, shouldAutoplay = true) => {
        const audio = audioRef.current;
        if (!audio) return;
        const item = playlist[index];
        if (!item) return;
        const seekTarget = Number.isFinite(startAt) ? startAt : item.startAt;
        const clipEnd = Number.isFinite(item.endAt) ? (item.endAt as number) : null;

        const sourceChanged = audio.src !== item.src;
        if (sourceChanged) {
            audio.pause();
            audio.src = item.src;
            audio.load();
            setSrc(item.src);
            setCurrentTime(0);
            setDuration(0);
        }

        setLabel(item.label);
        setCurrentSegmentId(item.id);
        clipEndRef.current = clipEnd;

        if (Number.isFinite(seekTarget) && (seekTarget as number) > 0) {
            audio.currentTime = seekTarget as number;
            setCurrentTime(seekTarget as number);
        } else if (sourceChanged) {
            audio.currentTime = 0;
            setCurrentTime(0);
        }

        if (
            clipEndRef.current !== null &&
            Number.isFinite(audio.currentTime) &&
            audio.currentTime >= clipEndRef.current
        ) {
            clipEndRef.current = null;
        }

        if (shouldAutoplay) {
            await audio.play().catch(() => undefined);
        }
    }, [playlist]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onLoadedMetadata = () => setDuration(audio.duration || 0);
        const onTimeUpdate = async () => {
            const current = audio.currentTime || 0;
            setCurrentTime(current);

            const clipEnd = clipEndRef.current;
            if (clipEnd === null || !Number.isFinite(clipEnd)) {
                return;
            }

            if (current >= clipEnd - 0.02) {
                if (autoplay && currentSegmentId !== null && playlist.length > 0) {
                    const currentIndex = playlist.findIndex((item) => item.id === currentSegmentId);
                    if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
                        await playByIndex(currentIndex + 1, undefined, true);
                        return;
                    }
                }

                audio.pause();
                if (Number.isFinite(clipEnd) && clipEnd > 0) {
                    audio.currentTime = clipEnd;
                    setCurrentTime(clipEnd);
                }
            }
        };
        const onEnded = async () => {
            setIsPlaying(false);
            if (!autoplay || currentSegmentId === null || playlist.length === 0) {
                return;
            }
            const currentIndex = playlist.findIndex((item) => item.id === currentSegmentId);
            if (currentIndex === -1 || currentIndex >= playlist.length - 1) {
                return;
            }
            await playByIndex(currentIndex + 1, undefined, true);
        };

        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onEnded);
        };
    }, [autoplay, currentSegmentId, playlist, playByIndex]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onMove = (event: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const next = clampPosition(event.clientX - dragOffsetRef.current.x, event.clientY - dragOffsetRef.current.y);
            setPosition(next);
        };
        const onUp = () => {
            isDraggingRef.current = false;
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [clampPosition]);

    const setSource = useCallback(async (nextSrc: string, options?: SetSourceOptions) => {
        const audio = audioRef.current;
        if (!audio) return;

        const shouldAutoplay = options?.autoplay ?? true;
        const sourceChanged = audio.src !== nextSrc;

        if (options?.label) {
            setLabel(options.label);
        }

        setPlaybackContext('generic');
        setPlaylist([]);
        setCurrentSegmentId(null);
        clipEndRef.current = Number.isFinite(options?.endAt) ? (options?.endAt as number) : null;

        if (sourceChanged) {
            audio.pause();
            audio.src = nextSrc;
            audio.load();
            setSrc(nextSrc);
            setCurrentTime(0);
            setDuration(0);
        }

        if (typeof options?.startAt === 'number' && Number.isFinite(options.startAt)) {
            audio.currentTime = Math.max(0, options.startAt);
            setCurrentTime(audio.currentTime);
        }

        if (
            clipEndRef.current !== null &&
            Number.isFinite(audio.currentTime) &&
            audio.currentTime >= clipEndRef.current
        ) {
            clipEndRef.current = null;
        }

        if (shouldAutoplay) {
            await audio.play().catch(() => undefined);
        }
    }, []);

    const playSegment = useCallback(async (options: PlaySegmentOptions) => {
        const normalized = options.playlist.filter((item) => item.src);
        setPlaybackContext(options.context);
        setPlaylist(normalized);
        const index = normalized.findIndex((item) => item.id === options.segmentId);
        if (index === -1) {
            return;
        }
        const audio = audioRef.current;
        if (!audio) return;
        const item = normalized[index];
        const sourceChanged = audio.src !== item.src;
        const clipEnd = Number.isFinite(options.endAt) ? (options.endAt as number) : item.endAt;

        if (sourceChanged) {
            audio.pause();
            audio.src = item.src;
            audio.load();
            setSrc(item.src);
            setCurrentTime(0);
            setDuration(0);
        }

        setLabel(item.label);
        setCurrentSegmentId(item.id);
        clipEndRef.current = Number.isFinite(clipEnd) ? (clipEnd as number) : null;

        if (Number.isFinite(options.startAt)) {
            audio.currentTime = Math.max(0, options.startAt as number);
            setCurrentTime(audio.currentTime);
        } else if (sourceChanged) {
            audio.currentTime = 0;
            setCurrentTime(0);
        }

        if (
            clipEndRef.current !== null &&
            Number.isFinite(audio.currentTime) &&
            audio.currentTime >= clipEndRef.current
        ) {
            clipEndRef.current = null;
        }

        const shouldAutoplay = options.autoplay ?? true;
        if (shouldAutoplay) {
            await audio.play().catch(() => undefined);
        }
    }, []);

    const play = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;
        await audio.play().catch(() => undefined);
    }, []);

    const pause = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
    }, []);

    const toggle = useCallback(async () => {
        const audio = audioRef.current;
        if (!audio || !audio.src) return;
        if (audio.paused) {
            await audio.play().catch(() => undefined);
        } else {
            audio.pause();
        }
    }, []);

    const seek = useCallback((time: number) => {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(time)) return;
        audio.currentTime = Math.max(0, Math.min(time, audio.duration || time));
        setCurrentTime(audio.currentTime);
    }, []);

    const setPlaybackRate = useCallback((rate: number) => {
        const audio = audioRef.current;
        if (!audio || !Number.isFinite(rate) || rate <= 0) return;
        audio.playbackRate = rate;
        setPlaybackRateState(rate);
    }, []);

    const next = useCallback(async () => {
        if (currentSegmentId === null || playlist.length === 0) return;
        const index = playlist.findIndex((item) => item.id === currentSegmentId);
        if (index === -1 || index >= playlist.length - 1) return;
        await playByIndex(index + 1, undefined, true);
    }, [currentSegmentId, playlist, playByIndex]);

    const previous = useCallback(async () => {
        if (currentSegmentId === null || playlist.length === 0) return;
        const index = playlist.findIndex((item) => item.id === currentSegmentId);
        if (index === -1 || index <= 0) return;
        await playByIndex(index - 1, undefined, true);
    }, [currentSegmentId, playlist, playByIndex]);

    const startDrag = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        isDraggingRef.current = true;
        dragOffsetRef.current = {
            x: event.clientX - position.x,
            y: event.clientY - position.y,
        };
    }, [position.x, position.y]);

    const value = useMemo<AudioPlayerContextValue>(() => ({
        src,
        label,
        isPlaying,
        duration,
        currentTime,
        playbackRate,
        playbackContext,
        playlist,
        currentSegmentId,
        autoplay,
        isMinimized,
        setSource,
        playSegment,
        play,
        pause,
        toggle,
        seek,
        setPlaybackRate,
        next,
        previous,
        setAutoplay,
        setMinimized: setIsMinimized,
    }), [src, label, isPlaying, duration, currentTime, playbackRate, playbackContext, playlist, currentSegmentId, autoplay, isMinimized, setSource, playSegment, play, pause, toggle, seek, setPlaybackRate, next, previous]);

    const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
    const sameSourceSegments = useMemo(() => {
        if (!src || duration <= 0) return [] as AudioPlaylistItem[];
        return playlist
            .filter((item) => item.src === src)
            .filter((item) => Number.isFinite(item.startAt) && Number.isFinite(item.endAt) && (item.endAt as number) > (item.startAt as number))
            .sort((a, b) => (a.startAt as number) - (b.startAt as number));
    }, [src, duration, playlist]);

    const activeSegment = useMemo(() => {
        if (currentSegmentId === null) return null;
        return playlist.find((item) => item.id === currentSegmentId) ?? null;
    }, [currentSegmentId, playlist]);

    const activeSegmentLeft =
        duration > 0 && Number.isFinite(activeSegment?.startAt)
            ? Math.max(0, Math.min(100, ((activeSegment?.startAt as number) / duration) * 100))
            : 0;
    const activeSegmentWidth =
        duration > 0 && Number.isFinite(activeSegment?.startAt) && Number.isFinite(activeSegment?.endAt)
            ? Math.max(0.6, Math.min(100, (((activeSegment?.endAt as number) - (activeSegment?.startAt as number)) / duration) * 100))
            : 0;

    useEffect(() => {
        return () => {
            waveformAbortRef.current?.abort();
            waveformAudioContextRef.current?.close?.();
        };
    }, []);

    return (
        <AudioPlayerContext.Provider value={value}>
            {children}
            <div
                className={`global-audio-player ${src ? 'visible' : ''} ${isMinimized ? 'minimized' : ''} ${isExpanded ? 'expanded' : ''}`}
                style={{ left: `${position.x}px`, top: `${position.y}px` }}
            >
                <div className="global-audio-handle" onMouseDown={startDrag}>
                    <span>::</span>
                    <span className="global-audio-context">{playbackContext}</span>
                </div>
                {!isMinimized && (
                    <>
                        <div className="global-audio-meta">{label}</div>
                        <div
                            className="global-audio-waveform"
                            onClick={(event) => {
                                const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                                const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
                                seek((duration || 0) * ratio);
                            }}
                        >
                            <div className="global-audio-waveform-bars">
                                {(waveformPeaks.length ? waveformPeaks : fallbackPeaks(src ?? 'global')).map((peak, index) => (
                                    <span
                                        key={index}
                                        className="global-audio-wave-bar"
                                        style={{ height: `${Math.max(12, Math.round(peak * 100))}%` }}
                                    />
                                ))}
                            </div>
                            {activeSegmentWidth > 0 && (
                                <div
                                    className="global-audio-segment-range"
                                    style={{ left: `${activeSegmentLeft}%`, width: `${activeSegmentWidth}%` }}
                                />
                            )}
                            <div className="global-audio-playhead" style={{ left: `${progress}%` }} />
                            {waveformLoading && <div className="global-audio-waveform-loading">Loading waveform…</div>}
                        </div>

                        {sameSourceSegments.length > 0 && (
                            <div className="global-audio-segments-axis">
                                {sameSourceSegments.map((segment) => {
                                    const start = segment.startAt as number;
                                    const end = segment.endAt as number;
                                    const left = Math.max(0, Math.min(100, (start / duration) * 100));
                                    const width = Math.max(0.5, Math.min(100, ((end - start) / duration) * 100));
                                    const isActive = segment.id === currentSegmentId;
                                    return (
                                        <button
                                            key={`${segment.id}-${segment.startAt}`}
                                            type="button"
                                            className={`global-audio-segment-chip ${isActive ? 'active' : ''}`}
                                            style={{ left: `${left}%`, width: `${width}%` }}
                                            title={`${segment.label} (${start.toFixed(1)}s - ${end.toFixed(1)}s)`}
                                            onClick={() => {
                                                void playSegment({
                                                    context: playbackContext,
                                                    playlist,
                                                    segmentId: segment.id,
                                                    startAt: start,
                                                    endAt: end,
                                                    autoplay: true,
                                                });
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {isExpanded && sameSourceSegments.length > 0 && (
                            <div className="global-audio-segment-list">
                                {sameSourceSegments.map((segment) => {
                                    const start = segment.startAt as number;
                                    const end = segment.endAt as number;
                                    return (
                                        <button
                                            key={`list-${segment.id}-${start}`}
                                            type="button"
                                            className={`global-audio-segment-list-item ${segment.id === currentSegmentId ? 'active' : ''}`}
                                            onClick={() => {
                                                void playSegment({
                                                    context: playbackContext,
                                                    playlist,
                                                    segmentId: segment.id,
                                                    startAt: start,
                                                    endAt: end,
                                                    autoplay: true,
                                                });
                                            }}
                                        >
                                            <span>{segment.label}</span>
                                            <span>{start.toFixed(1)}s - {end.toFixed(1)}s</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="global-audio-controls">
                            <button type="button" className="global-audio-btn" onClick={() => void previous()} disabled={!src || playlist.length <= 1}>⏮</button>
                            <button type="button" className="global-audio-btn" onClick={() => void toggle()} disabled={!src}>{isPlaying ? '⏸' : '▶'}</button>
                            <button type="button" className="global-audio-btn" onClick={() => void next()} disabled={!src || playlist.length <= 1}>⏭</button>
                            <button type="button" className="global-audio-btn" onClick={() => seek(currentTime - 5)} disabled={!src}>-5s</button>
                            <button type="button" className="global-audio-btn" onClick={() => seek(currentTime + 5)} disabled={!src}>+5s</button>
                            <button type="button" className={`global-audio-btn ${autoplay ? 'active' : ''}`} onClick={() => setAutoplay(!autoplay)}>
                                Auto
                            </button>
                            {isExpanded && (
                                <>
                                    <button type="button" className={`global-audio-btn ${playbackRate === 1 ? 'active' : ''}`} onClick={() => setPlaybackRate(1)}>1.0x</button>
                                    <button type="button" className={`global-audio-btn ${playbackRate === 1.25 ? 'active' : ''}`} onClick={() => setPlaybackRate(1.25)}>1.25x</button>
                                    <button type="button" className={`global-audio-btn ${playbackRate === 1.5 ? 'active' : ''}`} onClick={() => setPlaybackRate(1.5)}>1.5x</button>
                                </>
                            )}
                        </div>
                        <div className="global-audio-progress" onClick={(event) => {
                            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                            const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
                            seek((duration || 0) * ratio);
                        }}>
                            <div className="global-audio-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="global-audio-time">
                            {Math.floor(currentTime)}s / {Math.floor(duration || 0)}s
                        </div>
                    </>
                )}
                <div className="global-audio-window-actions">
                    <button type="button" className="global-audio-btn" onClick={() => setIsExpanded((prev) => !prev)}>{isExpanded ? '🗗' : '⛶'}</button>
                    <button type="button" className="global-audio-btn" onClick={() => setIsMinimized((prev) => !prev)}>{isMinimized ? '▢' : '—'}</button>
                    <button type="button" className="global-audio-btn" onClick={() => {
                        const audio = audioRef.current;
                        if (audio) {
                            audio.pause();
                            audio.removeAttribute('src');
                            audio.load();
                        }
                        clipEndRef.current = null;
                        setSrc(null);
                        setLabel('Global player');
                        setCurrentTime(0);
                        setDuration(0);
                        setIsPlaying(false);
                        setPlaylist([]);
                        setCurrentSegmentId(null);
                        setPlaybackContext('generic');
                        setWaveformPeaks([]);
                        setWaveformLoading(false);
                    }}>✕</button>
                </div>
            </div>
            <audio ref={audioRef} preload="metadata" />
        </AudioPlayerContext.Provider>
    );
};

export const useAudioPlayer = () => {
    const context = useContext(AudioPlayerContext);
    if (!context) {
        throw new Error('useAudioPlayer must be used within AudioPlayerProvider');
    }
    return context;
};
