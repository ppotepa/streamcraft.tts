import { useEffect } from 'react';

export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

interface UseHotkeysOptions {
    enabled?: boolean;
    ignoreInputFields?: boolean;
}

/**
 * Register keyboard shortcuts with automatic cleanup.
 * Ignores events from input/textarea by default.
 */
export function useHotkeys(keyMap: HotkeyMap, options: UseHotkeysOptions = {}) {
    const { enabled = true, ignoreInputFields = true } = options;

    useEffect(() => {
        if (!enabled) return;

        const handler = (e: KeyboardEvent) => {
            if (ignoreInputFields) {
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            }

            const key = e.code === 'Space' ? 'Space' : e.key;
            const callback = keyMap[key];
            if (callback) {
                callback(e);
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [keyMap, enabled, ignoreInputFields]);
}
