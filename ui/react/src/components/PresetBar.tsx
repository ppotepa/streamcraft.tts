import React from 'react';

interface PresetBarProps {
    label: string;
    presets: string[];
    value: string;
    onChange: (preset: string) => void;
    onSave?: () => void;
    onSaveAs?: () => void;
    onManage?: () => void;
}

export default function PresetBar({ label, presets, value, onChange, onSave, onSaveAs, onManage }: PresetBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
            <span className="text-sm text-slate-300">{label}</span>
            <select
                className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {presets.map((p) => (
                    <option key={p} value={p}>
                        {p}
                    </option>
                ))}
            </select>
            <div className="flex items-center gap-2 text-xs">
                <button className="px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent" onClick={onSave}>
                    Save
                </button>
                <button className="px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent" onClick={onSaveAs}>
                    Save as…
                </button>
                <button className="px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent" onClick={onManage}>
                    Manage
                </button>
            </div>
        </div>
    );
}
