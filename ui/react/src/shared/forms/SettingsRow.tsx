import React from 'react';

interface SettingsRowProps {
    label: string;
    help?: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    onChange: (value: number) => void;
    onReset?: () => void;
}

export default function SettingsRow({ label, help, value, min, max, step = 1, unit, onChange, onReset }: SettingsRowProps) {
    const minVal = min ?? 0;
    const maxVal = max ?? 100;
    const percentage = ((value - minVal) / (maxVal - minVal)) * 100;

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-200">
                    <span className="font-semibold">{label}</span>
                    {unit && <span className="text-xs text-slate-400">({unit})</span>}
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 text-center"
                        value={value}
                        min={min}
                        max={max}
                        step={step}
                        onChange={(e) => onChange(Number(e.target.value))}
                    />
                    {onReset && (
                        <button className="text-xs px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent transition-colors" onClick={onReset}>
                            Reset
                        </button>
                    )}
                </div>
            </div>
            {help && <p className="text-xs text-slate-400 leading-relaxed">{help}</p>}
            <input
                type="range"
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{
                    background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${percentage}%, #1e293b ${percentage}%, #1e293b 100%)`
                }}
            />
        </div>
    );
}
