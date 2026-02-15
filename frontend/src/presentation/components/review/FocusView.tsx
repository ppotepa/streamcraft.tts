/**
 * Focus View Modal - Immersive single-segment review with original comparison
 * 
 * Full-screen modal for detailed segment review with:
 * - Large waveform visualization (real audio data)
 * - Collapsible original audio comparison
 * - Keyboard shortcuts (A/R/S/O/Space/Arrows/Esc)
 * - Playback speed controls (0.5x - 1.5x)
 * - Navigation with auto-advance
 * - Metrics comparison (original vs cleaned)
 * 
 * @component
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAudioPlayer } from '../../context/audio-player.context';

export interface FocusViewSegment {
    index: number;
    start: number;
    end: number;
    duration: number;
    cleanStart?: number | null;
    cleanEnd?: number | null;
    text: string;
    confidence?: number;
    snrDb?: number;
    speechRatio?: number;
    kept?: boolean | null;
    cleanAudioUrl?: string;
    originalAudioUrl?: string;
    originalSnrDb?: number;
    originalConfidence?: number;
    originalSpeechRatio?: number;
}

export interface FocusViewProps {
    segment: FocusViewSegment;
    totalSegments: number;
    remaining: number;
    onAccept: () => void;
    onReject: () => void;
    onSkip: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onClose: () => void;
    onTextEdit: (newText: string) => void;
}

export const FocusView: React.FC<FocusViewProps> = ({
    segment,
    totalSegments,
    remaining,
    onAccept,
    onReject,
    onSkip,
    onPrevious,
    onNext,
    onClose,
    onTextEdit,
}) => {
    const [showOriginal, setShowOriginal] = useState(true);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [currentTime, setCurrentTime] = useState(0);
    const [waveformPeaks, setWaveformPeaks] = useState<number[]>([]);
    const [isLoadingWaveform, setIsLoadingWaveform] = useState(false);
    const [originalWaveformPeaks, setOriginalWaveformPeaks] = useState<number[]>([]);
    const [isLoadingOriginalWaveform, setIsLoadingOriginalWaveform] = useState(false);
    const textRef = useRef<HTMLDivElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const {
        src: playerSrc,
        currentTime: playerTime,
        isPlaying,
        setSource,
        toggle,
        setPlaybackRate,
    } = useAudioPlayer();

    const WAVEFORM_BARS = 60;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const extractWaveformPeaks = useCallback(async (audioUrl: string) => {
        if (!audioUrl || typeof window === 'undefined') {
            return null;
        }

        try {
            const response = await fetch(audioUrl, {
                signal: abortControllerRef.current?.signal
            });
            if (!response.ok) throw new Error('Failed to fetch audio');

            const arrayBuffer = await response.arrayBuffer();

            if (!audioContextRef.current) {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (!AudioContextClass) throw new Error('AudioContext not supported');
                audioContextRef.current = new AudioContextClass();
            }

            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            const channelData = audioBuffer.numberOfChannels > 0
                ? audioBuffer.getChannelData(0)
                : new Float32Array();

            // Extract peaks
            const sliceSize = Math.max(1, Math.floor(channelData.length / WAVEFORM_BARS));
            const peaks: number[] = [];

            for (let i = 0; i < WAVEFORM_BARS; i++) {
                const start = i * sliceSize;
                if (start >= channelData.length) {
                    peaks.push(0);
                    continue;
                }
                const end = i === WAVEFORM_BARS - 1
                    ? channelData.length
                    : Math.min(channelData.length, start + sliceSize);

                let max = 0;
                for (let j = start; j < end; j++) {
                    const sample = Math.abs(channelData[j]);
                    if (sample > max) max = sample;
                }
                peaks.push(max);
            }

            // Normalize peaks
            const maxPeak = Math.max(...peaks) || 1;
            return peaks.map(peak => (peak / maxPeak) * 100);
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('Failed to extract waveform:', error);
            }
            return null;
        }
    }, [WAVEFORM_BARS]);

    const createFallbackPeaks = useCallback((segmentIndex: number) => {
        return Array.from({ length: WAVEFORM_BARS }, (_, i) => {
            const x = (segmentIndex * 7 + i * 13) % 100;
            return 20 + (x % 70);
        });
    }, [WAVEFORM_BARS]);

    // Load waveform when segment changes
    useEffect(() => {
        if (!segment.cleanAudioUrl) {
            setWaveformPeaks([]);
        } else {
            setIsLoadingWaveform(true);
            abortControllerRef.current?.abort();
            abortControllerRef.current = new AbortController();

            extractWaveformPeaks(segment.cleanAudioUrl).then((peaks) => {
                if (peaks) {
                    setWaveformPeaks(peaks);
                } else {
                    setWaveformPeaks(createFallbackPeaks(segment.index));
                }
                setIsLoadingWaveform(false);
            });
        }

        if (!segment.originalAudioUrl) {
            setOriginalWaveformPeaks([]);
        } else {
            setIsLoadingOriginalWaveform(true);
            extractWaveformPeaks(segment.originalAudioUrl).then((peaks) => {
                if (peaks) {
                    setOriginalWaveformPeaks(peaks);
                } else {
                    setOriginalWaveformPeaks(createFallbackPeaks(segment.index + 97));
                }
                setIsLoadingOriginalWaveform(false);
            });
        }

        return () => {
            abortControllerRef.current?.abort();
        };
    }, [segment.cleanAudioUrl, segment.originalAudioUrl, segment.index, extractWaveformPeaks, createFallbackPeaks]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
            audioContextRef.current?.close?.();
        };
    }, []);

    const togglePlayback = () => {
        if (segment.cleanAudioUrl && playerSrc !== segment.cleanAudioUrl) {
            void setSource(segment.cleanAudioUrl, {
                autoplay: true,
                label: `Segment #${segment.index} (clean)`,
                startAt: Number.isFinite(segment.cleanStart) ? (segment.cleanStart as number) : 0,
                endAt: Number.isFinite(segment.cleanEnd) ? (segment.cleanEnd as number) : undefined,
            });
            return;
        }
        void toggle();
    };

    const playOriginal = () => {
        if (!segment.originalAudioUrl) return;
        void setSource(segment.originalAudioUrl, {
            autoplay: true,
            label: `Segment #${segment.index} (original)`,
            startAt: Number.isFinite(segment.start) ? segment.start : 0,
            endAt: Number.isFinite(segment.end) ? segment.end : undefined,
        });
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackSpeed(speed);
        setPlaybackRate(speed);
    };

    const handleTextBlur = () => {
        if (textRef.current) {
            onTextEdit(textRef.current.textContent || '');
        }
    };

    // Keyboard shortcuts - handles all review actions
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't trigger shortcuts if user is editing text
            const target = e.target as HTMLElement;
            if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'a':
                    e.preventDefault();
                    onAccept();
                    break;
                case 'r':
                    e.preventDefault();
                    onReject();
                    break;
                case 's':
                    e.preventDefault();
                    onSkip();
                    break;
                case 'o':
                    e.preventDefault();
                    setShowOriginal(!showOriginal);
                    break;
                case ' ':
                    e.preventDefault();
                    togglePlayback();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    onPrevious();
                    break;
                case 'arrowright':
                    e.preventDefault();
                    onNext();
                    break;
                case 'escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showOriginal, onAccept, onReject, onSkip, onPrevious, onNext, onClose]);

    // Track playhead only when focused segment clean source is active
    useEffect(() => {
        if (segment.cleanAudioUrl && playerSrc === segment.cleanAudioUrl) {
            setCurrentTime(playerTime);
        } else {
            setCurrentTime(0);
        }
    }, [segment.cleanAudioUrl, playerSrc, playerTime]);

    const progress = ((segment.index - 1) / totalSegments) * 100;

    return (
        <div className="focus-view-overlay" onClick={onClose}>
            <div className="focus-view-modal" onClick={(e) => e.stopPropagation()}>
                {/* Top Bar */}
                <div className="focus-top-bar">
                    <button className="btn" onClick={onClose}>
                        ← Back to List
                    </button>
                    <div className="progress-bar-container">
                        <div className="progress-text">
                            <span>Segment {segment.index} of {totalSegments}</span>
                            <span>{remaining} remaining</span>
                        </div>
                        <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                    <div className="focus-top-actions">
                        <button
                            className={`btn ${showOriginal ? 'active' : ''}`}
                            onClick={() => setShowOriginal(!showOriginal)}
                        >
                            {showOriginal ? '✓' : ''} Show Original (O)
                        </button>
                        <button className="btn-primary btn" onClick={onClose}>
                            ×
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="focus-content">
                    <div className="focus-card">
                        {/* Original Audio Section (Collapsed) */}
                        {showOriginal && segment.originalAudioUrl && (
                            <div className="original-section">
                                <div className="section-header">
                                    <div className="section-title">
                                        <span className="section-icon">🎵</span>
                                        <span>Original Audio</span>
                                    </div>
                                    <div className="section-badge badge-warning">Noisy</div>
                                </div>
                                <div className="section-content">
                                    <div className="waveform-placeholder original-wave">
                                        {isLoadingOriginalWaveform ? (
                                            <div className="wave-loading">Loading original waveform...</div>
                                        ) : (
                                            <div className="wave-bars">
                                                {(originalWaveformPeaks.length > 0 ? originalWaveformPeaks : Array(WAVEFORM_BARS).fill(50)).map((h, i) => (
                                                    <div key={i} className="wave-bar" style={{ height: `${Math.max(10, h)}%` }} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="metrics-row">
                                        <div className="metric-item">
                                            <span className="metric-label">SNR</span>
                                            <span className="metric-value medium">
                                                {segment.originalSnrDb?.toFixed(1) || 'N/A'} dB
                                            </span>
                                        </div>
                                        <div className="metric-item">
                                            <span className="metric-label">Confidence</span>
                                            <span className="metric-value medium">
                                                {segment.originalConfidence || 'N/A'}%
                                            </span>
                                        </div>
                                        <div className="metric-item">
                                            <span className="metric-label">Speech</span>
                                            <span className="metric-value medium">
                                                {segment.originalSpeechRatio ? Math.round(segment.originalSpeechRatio) : 'N/A'}%
                                            </span>
                                        </div>
                                        <button className="play-btn-mini original-play" onClick={playOriginal}>▶</button>
                                    </div>
                                    {segment.snrDb && segment.originalSnrDb && (
                                        <div className="improvement-indicator">
                                            ↑ SNR improved by {(segment.snrDb - segment.originalSnrDb).toFixed(1)} dB
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Cleaned Audio Section (Main) */}
                        <div className="cleaned-section">
                            <div className="card-header">
                                <div className="segment-badge">
                                    <div className="segment-number">{segment.index}</div>
                                    <div className="segment-meta">
                                        <div className="segment-time">
                                            {formatTime(segment.start)} - {formatTime(segment.end)}
                                        </div>
                                        <div className="segment-type">
                                            Duration: {segment.duration.toFixed(2)}s • Type: Clean
                                        </div>
                                    </div>
                                </div>
                                <div className="quick-stats">
                                    <div className="stat-item">
                                        <span className="stat-label">Confidence</span>
                                        <span className={`stat-value ${(segment.confidence || 0) >= 90 ? 'good' : ''}`}>
                                            {segment.confidence || 'N/A'}%
                                        </span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">SNR</span>
                                        <span className={`stat-value ${(segment.snrDb || 0) >= 15 ? 'good' : ''}`}>
                                            {segment.snrDb?.toFixed(1) || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">Speech</span>
                                        <span className={`stat-value ${(segment.speechRatio || 0) >= 90 ? 'good' : ''}`}>
                                            {segment.speechRatio ? Math.round(segment.speechRatio) : 'N/A'}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Waveform */}
                            <div className="waveform-section">
                                <div className="waveform-placeholder cleaned-wave">
                                    {isLoadingWaveform ? (
                                        <div className="wave-loading">Loading waveform...</div>
                                    ) : (
                                        <div className="wave-bars">
                                            {(waveformPeaks.length > 0 ? waveformPeaks : Array(WAVEFORM_BARS).fill(50)).map((height, i) => (
                                                <div key={i} className="wave-bar" style={{ height: `${Math.max(10, height)}%` }} />
                                            ))}
                                        </div>
                                    )}
                                    {segment.cleanAudioUrl && !isLoadingWaveform && (
                                        <div className="playhead" style={{ left: `${(currentTime / segment.duration) * 100}%` }} />
                                    )}
                                </div>
                                <div className="waveform-controls">
                                    <div className="playback-controls">
                                        <button className="play-btn" onClick={togglePlayback}>
                                            {isPlaying ? '⏸' : '▶'}
                                        </button>
                                        <div className="time-display">
                                            {formatTime(currentTime)} / {formatTime(segment.duration)}
                                        </div>
                                        <button className="btn">🔁 Loop</button>
                                    </div>
                                    <div className="playback-speed">
                                        {[0.5, 0.75, 1.0, 1.25, 1.5].map((speed) => (
                                            <button
                                                key={speed}
                                                className={`speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
                                                onClick={() => handleSpeedChange(speed)}
                                            >
                                                {speed}x
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Text */}
                            <div className="text-section">
                                <div className="text-label">
                                    <span>Transcription</span>
                                    <span className="edit-indicator">Click to edit (E)</span>
                                </div>
                                <div
                                    ref={textRef}
                                    className="text-content"
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBlur={handleTextBlur}
                                >
                                    {segment.text}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="actions-section">
                                <button className="action-btn accept" onClick={onAccept}>
                                    <div className="action-icon">✓</div>
                                    <div>Accept</div>
                                    <div className="action-shortcut">Press A</div>
                                </button>
                                <button className="action-btn reject" onClick={onReject}>
                                    <div className="action-icon">✕</div>
                                    <div>Reject</div>
                                    <div className="action-shortcut">Press R</div>
                                </button>
                                <button className="action-btn skip" onClick={onSkip}>
                                    <div className="action-icon">→</div>
                                    <div>Skip</div>
                                    <div className="action-shortcut">Press S</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Controls */}
                <div className="nav-controls">
                    <button className="nav-btn" onClick={onPrevious} title="Previous (←)">
                        ←
                    </button>
                    <button className="nav-btn" onClick={onNext} title="Next (→)">
                        →
                    </button>
                </div>
            </div>
        </div>
    );
};
