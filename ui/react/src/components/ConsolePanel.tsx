import React, { useEffect, useRef } from 'react';

interface ConsolePanelProps {
    logs: string[];
    collapsed: boolean;
    follow: boolean;
    onToggleCollapse: () => void;
    onToggleFollow: () => void;
    onClear: () => void;
}

export default function ConsolePanel({ logs, collapsed, follow, onToggleCollapse, onToggleFollow, onClear }: ConsolePanelProps) {
    const bodyRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!follow) return;
        const el = bodyRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [logs, follow]);

    return (
        <div className={`flex flex-col h-full rounded-xl border border-slate-800 bg-slate-950/80 shadow ${collapsed ? 'overflow-hidden' : ''}`}>
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
                <div className="text-sm font-semibold text-slate-100">Console</div>
                <div className="flex items-center gap-2 text-xs">
                    <button className="px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent" onClick={onToggleFollow}>
                        {follow ? 'Unfollow' : 'Follow'}
                    </button>
                    <button className="px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent" onClick={onClear}>
                        Clear
                    </button>
                    <button className="px-2 py-1 rounded border border-slate-700 hover:border-accent hover:text-accent" onClick={onToggleCollapse}>
                        {collapsed ? 'Expand' : 'Collapse'}
                    </button>
                </div>
            </div>
            {!collapsed && (
                <div ref={bodyRef} className="flex-1 overflow-auto px-3 py-3">
                    <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {logs.length === 0 ? 'No logs yet.' : logs.join('\n')}
                    </pre>
                </div>
            )}
        </div>
    );
}
