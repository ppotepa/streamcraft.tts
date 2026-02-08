import React, { useState } from 'react';

interface VoiceLabProps {
    vodUrl: string;
    onRun: (params: { useAccepted: boolean; iterations: number }) => void;
    onClose: () => void;
}

export default function VoiceLab({ vodUrl, onRun, onClose }: VoiceLabProps) {
    const [useAccepted, setUseAccepted] = useState(true);
    const [iterations, setIterations] = useState(3);

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-100">Voice Lab</h3>
                <button className="text-xs text-slate-400 hover:text-accent" onClick={onClose}>
                    Close
                </button>
            </div>
            <p className="text-sm text-slate-300">
                Iteratively refine voice isolation using accepted samples from segment review.
            </p>
            <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-200">
                    <input
                        type="checkbox"
                        checked={useAccepted}
                        onChange={(e) => setUseAccepted(e.target.checked)}
                        className="rounded"
                    />
                    Use accepted segments only
                </label>
                <div className="space-y-2">
                    <label className="text-sm text-slate-200">Training iterations</label>
                    <input
                        type="number"
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                        value={iterations}
                        onChange={(e) => setIterations(Number(e.target.value))}
                        min={1}
                        max={10}
                    />
                </div>
            </div>
            <button
                className="w-full px-4 py-2 rounded-lg bg-accent text-slate-950 font-semibold"
                onClick={() => onRun({ useAccepted, iterations })}
            >
                Run Voice Lab
            </button>
        </div>
    );
}
