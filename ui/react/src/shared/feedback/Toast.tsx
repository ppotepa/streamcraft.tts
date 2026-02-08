import React from 'react';

interface ToastProps {
    message: string;
}

export default function Toast({ message }: ToastProps) {
    return (
        <div className="fixed bottom-4 right-4 rounded-lg bg-slate-900 border border-slate-700 px-4 py-2 shadow text-sm text-slate-100">
            {message}
        </div>
    );
}
