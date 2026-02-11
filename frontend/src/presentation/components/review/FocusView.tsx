/**
 * Focus View Modal - Immersive single-segment review with original comparison
 * 
 * Full-screen modal for detailed segment review with:
 * - Large waveform visualization
 * - Collapsible original audio comparison
 * - Keyboard shortcuts (A/R/S/O/Space/Arrows/Esc)
 * - Playback speed controls (0.5x - 1.5x)
 * - Navigation with auto-advance
 * - Metrics comparison (original vs cleaned)
 * 
 * @component
 */
import React, { useState, useRef, useEffect } from 'react';

export interface FocusViewSegment {
    index: number;
    start: number;
    end: number;
    duration: number;
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
    const [showOriginal, setShowOriginal] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const cleanAudioRef = useRef<HTMLAudioElement | null>(null);
    const originalAudioRef = useRef<HTMLAudioElement | null>(null);
    const textRef = useRef<HTMLDivElement | null>(null);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const togglePlayback = () => {
        const audio = cleanAudioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackSpeed(speed);
        if (cleanAudioRef.current) {
            cleanAudioRef.current.playbackRate = speed;
        }
        if (originalAudioRef.current) {
            originalAudioRef.current.playbackRate = speed;
        }
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

    // Update current time
    useEffect(() => {
        const audio = cleanAudioRef.current;
        if (!audio) return;

        const updateTime = () => setCurrentTime(audio.currentTime);
        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('ended', () => setIsPlaying(false));

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('ended', () => setIsPlaying(false));
        };
    }, []);

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
                                        {/* Placeholder for original waveform */}
                                        <div className="wave-bars">
                                            {[40, 55, 70, 85, 90, 75, 65, 80, 95, 100, 90, 75, 60, 50].map((h, i) => (
                                                <div key={i} className="wave-bar" style={{ height: `${h}%` }} />
                                            ))}
                                        </div>
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
                                                {segment.originalSpeechRatio || 'N/A'}%
                                            </span>
                                        </div>
                                        <button className="play-btn-mini original-play">▶</button>
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
                                            {segment.speechRatio || 'N/A'}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Waveform */}
                            <div className="waveform-section">
                                <div className="waveform-placeholder cleaned-wave">
                                    <div className="wave-bars">
                                        {[50, 65, 80, 90, 95, 85, 70, 75, 90, 100, 95, 85, 70, 60].map((h, i) => (
                                            <div key={i} className="wave-bar" style={{ height: `${h}%` }} />
                                        ))}
                                    </div>
                                    <div className="playhead" style={{ left: '35%' }} />
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

                {/* Audio elements */}
                {segment.cleanAudioUrl && (
                    <audio ref={cleanAudioRef} src={segment.cleanAudioUrl} />
                )}
                {segment.originalAudioUrl && (
                    <audio ref={originalAudioRef} src={segment.originalAudioUrl} />
                )}
            </div>
        </div>
    );
};
