/**
 * Toast Notification System
 * Displays temporary messages for success, error, warning, and info
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
}

interface ToastContextValue {
    toasts: Toast[];
    showToast: (type: ToastType, message: string, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    const showToast = useCallback(
        (type: ToastType, message: string, duration: number = 5000) => {
            const id = `toast-${Date.now()}-${Math.random()}`;
            const toast: Toast = { id, type, message, duration };

            setToasts((prev) => [...prev, toast]);

            if (duration > 0) {
                setTimeout(() => {
                    removeToast(id);
                }, duration);
            }
        },
        [removeToast]
    );

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
};

interface ToastContainerProps {
    toasts: Toast[];
    onRemove: (id: string) => void;
}

const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
            {toasts.map((toast) => (
                <ToastMessage key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
};

interface ToastMessageProps {
    toast: Toast;
    onRemove: (id: string) => void;
}

const ToastMessage = ({ toast, onRemove }: ToastMessageProps) => {
    const getStyles = (): string => {
        const base =
            'flex items-start p-4 rounded-lg shadow-lg border animate-slide-in-right';

        switch (toast.type) {
            case 'success':
                return `${base} bg-green-50 border-green-200 text-green-800`;
            case 'error':
                return `${base} bg-red-50 border-red-200 text-red-800`;
            case 'warning':
                return `${base} bg-yellow-50 border-yellow-200 text-yellow-800`;
            case 'info':
                return `${base} bg-blue-50 border-blue-200 text-blue-800`;
            default:
                return `${base} bg-gray-50 border-gray-200 text-gray-800`;
        }
    };

    const getIcon = (): string => {
        switch (toast.type) {
            case 'success':
                return '✓';
            case 'error':
                return '✕';
            case 'warning':
                return '⚠';
            case 'info':
                return 'ℹ';
            default:
                return '●';
        }
    };

    return (
        <div className={getStyles()} role="alert">
            <span className="text-xl mr-3">{getIcon()}</span>
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
                onClick={() => onRemove(toast.id)}
                className="ml-3 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
            >
                ✕
            </button>
        </div>
    );
};
