import React from 'react';

interface WaveformBarsProps {
    bars: number[];
}

export default function WaveformBars({ bars }: WaveformBarsProps) {
    return (
        <div className="flex items-end gap-[2px] h-16 rounded-lg border border-slate-800 bg-slate-950 px-2 py-2 overflow-hidden">
            {bars.map((v, idx) => (
                <div
                    key={idx}
                    className="w-[3px] bg-accent/80"
                    style={{ height: `${Math.max(8, v * 60)}%` }}
                ></div>
            ))}
        </div>
    );
}
