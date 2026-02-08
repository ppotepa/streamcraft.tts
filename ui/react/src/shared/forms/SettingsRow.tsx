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
    return (
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
            <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-slate-200">
                    <span className="font-semibold">{label}</span>
                    {unit && <span className="text-xs text-slate-400">({unit})</span>}
                </div>
                {help && <p className="text-xs text-slate-400">{help}</p>}
            </div>
            <input
                type="range"
                className="flex-1"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
            <input
                type="number"
                className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
            {onReset && (
                <button className="text-xs px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent" onClick={onReset}>
                    Reset
                </button>
            )}
        </div>
    );
}
