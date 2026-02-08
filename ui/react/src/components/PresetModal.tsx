import React, { useState } from 'react';

export interface PresetModalProps {
    mode: 'saveAs' | 'manage';
    currentPresets: string[];
    onClose: () => void;
    onSaveAs?: (name: string) => void;
    onDelete?: (name: string) => void;
}

export default function PresetModal({ mode, currentPresets, onClose, onSaveAs, onDelete }: PresetModalProps) {
    const [newName, setNewName] = useState('');

    const handleSaveAs = () => {
        if (newName.trim() && onSaveAs) {
            onSaveAs(newName.trim());
            onClose();
        }
    };

    const handleDelete = (name: string) => {
        if (onDelete) {
            onDelete(name);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-100">{mode === 'saveAs' ? 'Save Preset As' : 'Manage Presets'}</h3>
                    <button className="text-slate-400 hover:text-accent" onClick={onClose}>
                        ✕
                    </button>
                </div>
                {mode === 'saveAs' ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm text-slate-200">Preset name</label>
                            <input
                                type="text"
                                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="My Custom Preset"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button className="px-4 py-2 rounded-lg border border-slate-700 hover:border-accent hover:text-accent text-sm" onClick={onClose}>
                                Cancel
                            </button>
                            <button className="px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold text-sm disabled:opacity-50" onClick={handleSaveAs} disabled={!newName.trim()}>
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {currentPresets.length === 0 ? (
                            <p className="text-sm text-slate-400">No custom presets yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {currentPresets.map((preset) => (
                                    <li key={preset} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                                        <span className="text-sm text-slate-100">{preset}</span>
                                        <button className="text-xs text-red-400 hover:text-red-300" onClick={() => handleDelete(preset)}>
                                            Delete
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="flex justify-end pt-2">
                            <button className="px-4 py-2 rounded-lg border border-slate-700 hover:border-accent hover:text-accent text-sm" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
