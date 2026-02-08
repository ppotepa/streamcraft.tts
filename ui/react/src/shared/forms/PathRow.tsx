import React from 'react';

interface PathRowProps {
    label: string;
    path: string;
    onCopy?: (path: string) => void;
}

export default function PathRow({ label, path, onCopy }: PathRowProps) {
    const copyPath = async () => {
        try {
            await navigator.clipboard.writeText(path);
            onCopy?.(path);
        } catch (err) {
            console.warn('Copy failed', err);
        }
    };

    const openPath = () => {
        window.open(path, '_blank');
    };

    return (
        <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
            <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
                <span className="font-mono text-[13px] text-slate-100 break-all">{path}</span>
            </div>
            <div className="flex items-center gap-2">
                <button className="text-xs px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent" onClick={copyPath}>
                    Copy
                </button>
                <button className="text-xs px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent" onClick={openPath}>
                    Open
                </button>
            </div>
        </div>
    );
}
