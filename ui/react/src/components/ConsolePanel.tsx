import React, { useEffect, useRef } from 'react';

interface ConsolePanelProps {
    logs: string[];
    collapsed: boolean;
    follow: boolean;
    onToggleCollapse: () => void;
    onToggleFollow: () => void;
}

/**
 * Minimal, docked log viewer. No actions on the stream itself; only collapse and autoscroll.
 */
export default function ConsolePanel({ logs, collapsed, follow, onToggleCollapse, onToggleFollow }: ConsolePanelProps) {
    const bodyRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!follow) return;
        const el = bodyRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [logs, follow]);

    return (
        <div className={`border-t border-slate-800 bg-slate-950/90 backdrop-blur shadow-xl ${collapsed ? 'h-10' : 'h-64'} transition-[height] duration-200 w-full`}>
            <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100">Console</span>
                    <span className="text-slate-500">(read-only)</span>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                        <input type="checkbox" className="accent-sky-400" checked={follow} onChange={onToggleFollow} />
                        <span className="text-[11px] text-slate-400">Auto-scroll</span>
                    </label>
                    <button
                        className="text-[11px] px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent"
                        onClick={onToggleCollapse}
                    >
                        {collapsed ? 'Show logs' : 'Hide'}
                    </button>
                </div>
            </div>
            {!collapsed && (
                <div ref={bodyRef} className="h-[200px] overflow-auto px-4 pb-3">
                    <pre className="text-[11px] font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {logs.length === 0 ? 'No logs yet.' : logs.join('\n')}
                    </pre>
                </div>
            )}
        </div>
    );
}
