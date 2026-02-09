/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree
 */

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('ErrorBoundary caught error:', error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render(): ReactNode {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback(this.state.error, this.state.errorInfo!);
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                    <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
                        <div className="flex items-center mb-4">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-12 w-12 text-red-500"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                    />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    Something went wrong
                                </h2>
                            </div>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-2">
                                    Error Message:
                                </h3>
                                <pre className="bg-red-50 border border-red-200 rounded p-4 text-sm text-red-800 overflow-auto">
                                    {this.state.error.toString()}
                                </pre>
                            </div>

                            {this.state.errorInfo && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                                        Component Stack:
                                    </h3>
                                    <pre className="bg-gray-50 border border-gray-200 rounded p-4 text-xs text-gray-600 overflow-auto max-h-64">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </div>
                            )}

                            <div className="flex space-x-4 pt-4">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Reload Page
                                </button>
                                <button
                                    onClick={() =>
                                        this.setState({ hasError: false, error: null, errorInfo: null })
                                    }
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
