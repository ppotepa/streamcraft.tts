/**
 * Timeline View Component - Horizontal scrolling card timeline
 * 
 * Alternative view displaying segments as cards in a timeline:
 * - Horizontal scrolling layout
 * - Card-based design with mini waveforms
 * - Visual browsing experience
 * - Metrics and status on each card
 * - Click to open focus view
 * 
 * @component
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface TimelineSegment {
    index: number;
    start: number;
    end: number;
    duration: number;
    text: string;
    confidence?: number;
    snrDb?: number;
    speechRatio?: number;
    kept?: boolean | null;
    rejectReason?: string[];
    cleanAudioUrl?: string;
    waveformSamples?: number[];
}

export interface TimelineViewProps {
    segments: TimelineSegment[];
    currentPlayingSegmentId?: number | null;
    onSegmentClick: (segment: TimelineSegment) => void;
    onSegmentAction: (index: number, action: 'accept' | 'reject' | 'play' | 'edit') => void;
    onClose: () => void;
    transcriptSegments?: Array<{ index: number; text: string; kept?: boolean | null }>;
}

const WAVEFORM_BUCKETS = 28;

const formatTimestamp = (seconds: number) => {
    if (!Number.isFinite(seconds)) {
        return '--:--';
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds - mins * 60;
    return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
};

const truncateText = (text: string, limit = 140) => {
    if (!text) return '—';
    return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
};

const statusMeta = (segment: TimelineSegment) => {
    if (segment.kept === true) return { label: 'Accepted', tone: 'kept' };
    if (segment.kept === false) return { label: 'Rejected', tone: 'rejected' };
    return { label: 'Review', tone: 'review' };
};

const condenseSamples = (values: ArrayLike<number>, bucketCount = WAVEFORM_BUCKETS): number[] => {
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
            if (sample > max) {
                max = sample;
            }
        }
        peaks.push(max);
    }
    const maxPeak = Math.max(...peaks) || 1;
    return peaks.map((peak) => (maxPeak === 0 ? 0 : peak / maxPeak));
};

const placeholderPeaks = (seed: number, bucketCount = WAVEFORM_BUCKETS) => {
    const result: number[] = [];
    let x = Math.abs(seed) + 1;
    for (let i = 0; i < bucketCount; i++) {
        x = (x * 9301 + 49297) % 233280;
        const value = 0.18 + (x / 233280) * 0.7;
        result.push(Math.min(1, Math.max(0.08, value)));
    }
    return result;
};

const useWaveformCache = (segments: TimelineSegment[]) => {
    const [waveforms, setWaveforms] = useState<Record<number, number[]>>(() => {
        const initial: Record<number, number[]> = {};
        segments.forEach((segment) => {
            if (segment.waveformSamples?.length) {
                initial[segment.index] = condenseSamples(segment.waveformSamples);
            }
        });
        return initial;
    });

    useEffect(() => {
        setWaveforms((prev) => {
            let mutated = false;
            const next = { ...prev };
            segments.forEach((segment) => {
                if (!next[segment.index] && segment.waveformSamples?.length) {
                    next[segment.index] = condenseSamples(segment.waveformSamples);
                    mutated = true;
                }
            });
            return mutated ? next : prev;
        });
    }, [segments]);

    return [waveforms, setWaveforms] as const;
};

export const TimelineView: React.FC<TimelineViewProps> = ({
    segments,
    currentPlayingSegmentId,
    onSegmentClick,
    onSegmentAction,
    onClose,
    transcriptSegments,
}) => {
    const [activeId, setActiveId] = useState<number | null>(segments[0]?.index ?? null);
    const [waveforms, setWaveforms] = useWaveformCache(segments);
    const transcriptListRef = useRef<HTMLDivElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const pendingWaveforms = useRef<Set<number>>(new Set());
    const abortControllers = useRef<Map<number, AbortController>>(new Map());

    useEffect(() => {
        if (!segments.length) {
            setActiveId(null);
            return;
        }
        setActiveId((current) => {
            if (current !== null && segments.some((segment) => segment.index === current)) {
                return current;
            }
            return segments[0].index;
        });
    }, [segments]);

    useEffect(() => {
        if (!currentPlayingSegmentId) return;
        if (!segments.some((segment) => segment.index === currentPlayingSegmentId)) return;
        setActiveId(currentPlayingSegmentId);
    }, [currentPlayingSegmentId, segments]);

    useEffect(() => {
        return () => {
            abortControllers.current.forEach((controller) => controller.abort());
            abortControllers.current.clear();
            audioContextRef.current?.close?.();
        };
    }, []);

    // Handle ESC key to close
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const activeIndex = useMemo(() => {
        if (!segments.length) return -1;
        if (activeId === null) return 0;
        const idx = segments.findIndex((segment) => segment.index === activeId);
        return idx === -1 ? 0 : idx;
    }, [segments, activeId]);

    const visibleSegments = useMemo(() => {
        if (!segments.length) return [null, null, null] as const;
        const base = activeIndex === -1 ? 0 : activeIndex;
        const prev = base > 0 ? segments[base - 1] : null;
        const current = segments[base] ?? null;
        const next = base < segments.length - 1 ? segments[base + 1] : null;
        return [prev, current, next] as const;
    }, [segments, activeIndex]);

    const isAtStart = activeIndex <= 0;
    const isAtEnd = activeIndex >= segments.length - 1;

    const ensureWaveform = useCallback(async (segment: TimelineSegment) => {
        if (!segment.cleanAudioUrl || typeof window === 'undefined') {
            return;
        }
        if (waveforms[segment.index] || pendingWaveforms.current.has(segment.index)) {
            return;
        }

        const controller = new AbortController();
        abortControllers.current.set(segment.index, controller);
        pendingWaveforms.current.add(segment.index);

        try {
            const response = await fetch(segment.cleanAudioUrl, { signal: controller.signal });
            if (!response.ok) throw new Error('Unable to fetch audio');

            const arrayBuffer = await response.arrayBuffer();
            if (!audioContextRef.current) {
                const Ctx = (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
                if (!Ctx) throw new Error('AudioContext unsupported');
                audioContextRef.current = new Ctx();
            }

            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            const channelData = audioBuffer.numberOfChannels > 0
                ? audioBuffer.getChannelData(0)
                : new Float32Array();
            const peaks = condenseSamples(channelData);
            setWaveforms((prev) => {
                if (prev[segment.index]) return prev;
                return { ...prev, [segment.index]: peaks.length ? peaks : placeholderPeaks(segment.index) };
            });
        } catch (err) {
            setWaveforms((prev) => {
                if (prev[segment.index]) return prev;
                return { ...prev, [segment.index]: placeholderPeaks(segment.index) };
            });
        } finally {
            pendingWaveforms.current.delete(segment.index);
            abortControllers.current.delete(segment.index);
        }
    }, [waveforms, setWaveforms]);

    useEffect(() => {
        visibleSegments.forEach((segment) => {
            if (segment) {
                ensureWaveform(segment);
            }
        });
    }, [visibleSegments, ensureWaveform]);

    const handleNavigate = useCallback((direction: 'prev' | 'next') => {
        if (segments.length <= 1) return;
        const base = activeIndex === -1 ? 0 : activeIndex;
        if (direction === 'prev') {
            if (base <= 0) return;
            setActiveId(segments[base - 1].index);
            return;
        }
        if (base >= segments.length - 1) return;
        setActiveId(segments[base + 1].index);
    }, [segments, activeIndex]);

    const handleKeyboardNav = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            handleNavigate('prev');
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            handleNavigate('next');
        }
    };

    const transcript = useMemo(() => {
        if (transcriptSegments?.length) {
            return transcriptSegments;
        }
        return segments.map((segment) => ({
            index: segment.index,
            text: segment.text,
            kept: segment.kept ?? null,
        }));
    }, [segments, transcriptSegments]);

    useEffect(() => {
        if (!currentPlayingSegmentId || !transcriptListRef.current) return;
        const node = transcriptListRef.current.querySelector(`[data-transcript-id="${currentPlayingSegmentId}"]`) as HTMLDivElement | null;
        node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [currentPlayingSegmentId, transcript]);

    const renderCard = (segment: TimelineSegment | null, slot: 'prev' | 'active' | 'next') => {
        if (!segment) {
            return (
                <article key={`ghost-${slot}`} className={`timeline-card ghost ${slot}`}>
                    <div className="timeline-card-placeholder">Awaiting segment</div>
                </article>
            );
        }

        const { label, tone } = statusMeta(segment);
        const waveform = waveforms[segment.index];
        const peaks = waveform && waveform.length ? waveform : placeholderPeaks(segment.index);
        const hasRealWaveform = Boolean(waveform && waveform.length);
        const isActive = slot === 'active';
        const statusTintClass = segment.kept === true ? 'card-kept' : segment.kept === false ? 'card-rejected' : '';
        const isPlaying = currentPlayingSegmentId === segment.index;

        return (
            <article
                key={segment.index}
                className={`timeline-card ${slot} ${isActive ? 'highlight' : 'dimmed'} ${statusTintClass} ${isPlaying ? 'segment-playing' : ''}`}
                onClick={() => setActiveId(segment.index)}
                onDoubleClick={() => onSegmentClick(segment)}
            >
                <header className="timeline-card-head">
                    <div className="timeline-chip">#{segment.index.toString().padStart(3, '0')}</div>
                    <div className={`timeline-status status-${tone}`}>{label}</div>
                </header>
                <div className="timeline-card-time">
                    <span>{formatTimestamp(segment.start)} – {formatTimestamp(segment.end)}</span>
                    <span>{segment.duration.toFixed(1)}s</span>
                </div>
                <div className={`mini-waveform ${hasRealWaveform ? 'live' : 'placeholder'}`}>
                    {peaks.map((height, index) => (
                        <span
                            key={index}
                            className="mini-waveform-bar"
                            style={{ height: `${Math.max(14, Math.round(height * 100))}%` }}
                        />
                    ))}
                </div>
                <p className="timeline-card-text">{truncateText(segment.text)}</p>
                <div className="timeline-card-metrics">
                    <div>
                        <span className="metric-label">Conf</span>
                        <strong>{segment.confidence ?? '—'}%</strong>
                    </div>
                    <div>
                        <span className="metric-label">SNR</span>
                        <strong>{segment.snrDb?.toFixed(1) ?? '—'} dB</strong>
                    </div>
                    <div>
                        <span className="metric-label">Speech</span>
                        <strong>{segment.speechRatio ? Math.round(segment.speechRatio) : '—'}%</strong>
                    </div>
                </div>
                <div className="timeline-card-actions">
                    <button
                        className="timeline-icon-btn"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSegmentAction(segment.index, 'play');
                        }}
                        aria-label="Play segment"
                    >
                        ▶
                    </button>
                    <button
                        className="timeline-icon-btn"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSegmentAction(segment.index, 'edit');
                        }}
                        aria-label="Edit segment"
                    >
                        ✎
                    </button>
                    <button
                        className="timeline-icon-btn accept"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSegmentAction(segment.index, 'accept');
                        }}
                        aria-label="Accept segment"
                    >
                        ✓
                    </button>
                    <button
                        className="timeline-icon-btn reject"
                        onClick={(event) => {
                            event.stopPropagation();
                            onSegmentAction(segment.index, 'reject');
                        }}
                        aria-label="Reject segment"
                    >
                        ✕
                    </button>
                </div>
            </article>
        );
    };

    if (segments.length === 0) {
        return (
            <div className="timeline-view-overlay" onClick={onClose}>
                <div className="timeline-view-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="timeline-view empty-state">
                        <p className="empty-title">No segments to review</p>
                        <p className="empty-copy">Run sanitize on a VOD or upload audio to get started.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="timeline-view-overlay" onClick={onClose}>
            <div className="timeline-view-modal" onClick={(e) => e.stopPropagation()}>
                {/* Close button */}
                <button
                    className="timeline-close-btn"
                    onClick={onClose}
                    aria-label="Close timeline view"
                >
                    ✕
                </button>

                <div className="timeline-view slot-machine">
                    <div className="timeline-machine">
                        <button
                            className="timeline-nav"
                            onClick={() => handleNavigate('prev')}
                            disabled={segments.length <= 1 || isAtStart}
                            aria-label="Previous segment"
                        >
                            ←
                        </button>
                        <div
                            className="timeline-window"
                            tabIndex={0}
                            role="region"
                            aria-label="Timeline review"
                            onKeyDown={handleKeyboardNav}
                        >
                            {renderCard(visibleSegments[0], 'prev')}
                            {renderCard(visibleSegments[1], 'active')}
                            {renderCard(visibleSegments[2], 'next')}
                        </div>
                        <button
                            className="timeline-nav"
                            onClick={() => handleNavigate('next')}
                            disabled={segments.length <= 1 || isAtEnd}
                            aria-label="Next segment"
                        >
                            →
                        </button>
                    </div>
                    <div className="timeline-transcript-panel">
                        <div className="timeline-transcript-title">Transcript</div>
                        <div className="timeline-transcript-list" ref={transcriptListRef}>
                            {transcript.map((item) => {
                                const isActive = item.index === activeId;
                                const isPlaying = item.index === currentPlayingSegmentId;
                                const toneClass = item.kept === true ? 'kept' : item.kept === false ? 'rejected' : 'review';
                                return (
                                    <div
                                        key={item.index}
                                        data-transcript-id={item.index}
                                        className={`transcript-bubble ${toneClass} ${isActive ? 'active' : ''} ${isPlaying ? 'playing' : ''}`}
                                        onClick={() => setActiveId(item.index)}
                                    >
                                        <span className="transcript-bubble-id">#{item.index}</span>
                                        <span className="transcript-bubble-text">{truncateText(item.text, 180)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
