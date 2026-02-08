import { useState, useCallback } from 'react';

interface UseLoggerOptions {
    maxLogs?: number;
    prefix?: string;
}

/**
 * Centralized logging hook with console history management
 */
export function useLogger(options: UseLoggerOptions = {}) {
    const { maxLogs = 1000, prefix = '' } = options;
    const [logs, setLogs] = useState<string[]>(['[i] Ready']);

    const appendLog = useCallback(
        (message: string) => {
            const timestamp = new Date().toLocaleTimeString();
            const formatted = prefix ? `${prefix} ${message}` : message;
            setLogs((prev) => {
                const updated = [...prev, `[${timestamp}] ${formatted}`];
                return updated.slice(-maxLogs);
            });
        },
        [maxLogs, prefix]
    );

    const clearLogs = useCallback(() => {
        setLogs(['[i] Logs cleared']);
    }, []);

    return { logs, appendLog, clearLogs };
}

export default useLogger;
