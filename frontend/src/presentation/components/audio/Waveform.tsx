/**
 * Waveform component - displays audio waveform with segment markers
 */

import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import { useHoverStore } from '../../../application/shared/useHoverStore';

export interface WaveformSegment {
    index: number;
    start: number;
    end: number;
    kept: boolean;
}

export interface WaveformProps {
    audioUrl: string;
    segments: WaveformSegment[];
    activeSegment?: number | null;
    onSegmentClick?: (segmentIndex: number) => void;
    onReady?: () => void;
    height?: number;
    waveColor?: string;
    progressColor?: string;
}

export const Waveform: React.FC<WaveformProps> = ({
    audioUrl,
    segments,
    activeSegment = null,
    onSegmentClick,
    onReady,
    height = 120,
    waveColor = '#6ca6ff',
    progressColor = '#8b5cf6',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const regionsPluginRef = useRef<RegionsPlugin | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const { hoveredSegmentIndex, setHoveredSegment } = useHoverStore();
    const regionsMapRef = useRef<Map<number, any>>(new Map());

    // Initialize WaveSurfer
    useEffect(() => {
        if (!containerRef.current) return;

        // Create regions plugin
        const regionsPlugin = RegionsPlugin.create();
        regionsPluginRef.current = regionsPlugin;

        // Create wavesurfer instance
        const wavesurfer = WaveSurfer.create({
            container: containerRef.current,
            waveColor: waveColor,
            progressColor: progressColor,
            height: height,
            barWidth: 3,
            barGap: 2,
            barRadius: 2,
            cursorWidth: 2,
            cursorColor: '#f3b13f',
            backend: 'WebAudio',
            plugins: [regionsPlugin],
        });

        wavesurferRef.current = wavesurfer;

        // Load audio
        wavesurfer.load(audioUrl);

        // Event listeners
        wavesurfer.on('ready', () => {
            setIsReady(true);
            setDuration(wavesurfer.getDuration());
            if (onReady) onReady();
        });

        wavesurfer.on('timeupdate', (time) => {
            setCurrentTime(time);
        });

        wavesurfer.on('error', (error) => {
            console.error('WaveSurfer error:', error);
        });

        // Cleanup
        return () => {
            wavesurfer.destroy();
        };
    }, [audioUrl, height, waveColor, progressColor, onReady]);

    // Update regions when segments change
    useEffect(() => {
        if (!isReady || !regionsPluginRef.current) return;

        // Clear existing regions
        regionsPluginRef.current.clearRegions();
        regionsMapRef.current.clear();

        // Add segment regions
        segments.forEach((segment) => {
            const isActive = segment.index === activeSegment;
            const isHovered = segment.index === hoveredSegmentIndex;

            let color: string;
            if (isHovered) {
                // Bright highlight on hover
                color = segment.kept
                    ? 'rgba(61, 220, 151, 0.5)'
                    : 'rgba(225, 92, 92, 0.5)';
            } else if (isActive) {
                // Medium highlight for active
                color = segment.kept
                    ? 'rgba(61, 220, 151, 0.35)'
                    : 'rgba(225, 92, 92, 0.35)';
            } else {
                // Default subtle color
                color = segment.kept
                    ? 'rgba(61, 220, 151, 0.2)'
                    : 'rgba(225, 92, 92, 0.2)';
            }

            const region = regionsPluginRef.current!.addRegion({
                start: segment.start,
                end: segment.end,
                color: color,
                drag: false,
                resize: false,
                content: `<div style="font-size: 10px; font-weight: 700; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.5); padding: 2px 4px;">${segment.index}</div>`,
            });

            regionsMapRef.current.set(segment.index, region);

            // Click handler
            region.on('click', (e) => {
                e.stopPropagation();
                if (onSegmentClick) {
                    onSegmentClick(segment.index);
                }
            });

            // Hover handlers
            region.on('enter', () => {
                setHoveredSegment(segment.index);
            });

            region.on('leave', () => {
                setHoveredSegment(null);
            });
        });
    }, [segments, isReady, activeSegment, hoveredSegmentIndex, onSegmentClick, setHoveredSegment]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="waveform-wrapper">
            <div ref={containerRef} className="waveform-container-inner" />
            {isReady && (
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span>{formatTime(0)}</span>
                    <span>Current: {formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            )}
            {!isReady && (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    Loading waveform...
                </div>
            )}
        </div>
    );
};
