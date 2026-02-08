import { useEffect } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface UseKeyboardShortcutsOptions {
    enabled?: boolean;
    ignoreInputFields?: boolean;
}

/**
 * Register keyboard shortcuts for navigation and actions.
 * Automatically ignores shortcuts when typing in input fields.
 */
export function useKeyboardShortcuts(
    handlers: Record<string, KeyHandler>,
    options: UseKeyboardShortcutsOptions = {}
) {
    const { enabled = true, ignoreInputFields = true } = options;

    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (ignoreInputFields) {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    return;
                }
            }

            const handler = handlers[e.key];
            if (handler) {
                handler(e);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlers, enabled, ignoreInputFields]);
}

export default useKeyboardShortcuts;
