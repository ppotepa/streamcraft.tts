/**
 * Main Application Component
 * Sets up routing, DI container, error boundaries, and toast notifications
 */

import { StrictMode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { DependencyProvider } from './presentation/context/dependency-context';
import { AudioPlayerProvider } from './presentation/context/audio-player.context';
import { ErrorBoundary } from './presentation/shared/error-boundary';
import { ToastProvider } from './presentation/shared/toast';
import { MainLayout } from './presentation/layouts';
import { routes } from './routes';

// Create router with MainLayout wrapper
const router = createBrowserRouter([
    {
        path: '/',
        element: <MainLayout />,
        children: routes,
    },
]);

export const App = () => {
    return (
        <StrictMode>
            <ErrorBoundary>
                <DependencyProvider>
                    <AudioPlayerProvider>
                        <ToastProvider>
                            <RouterProvider router={router} />
                        </ToastProvider>
                    </AudioPlayerProvider>
                </DependencyProvider>
            </ErrorBoundary>
        </StrictMode>
    );
};
