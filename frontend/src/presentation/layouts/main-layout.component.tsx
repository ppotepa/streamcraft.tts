/**
 * Main Layout Component
 * Provides navigation and consistent structure across all pages
 */

import { Outlet, Link, useLocation } from 'react-router-dom';

export const MainLayout = () => {
    const location = useLocation();

    const isActive = (path: string): boolean => {
        return location.pathname === path || location.pathname.startsWith(path + '/');
    };

    const linkClass = (path: string): string => {
        const base = 'px-4 py-2 rounded-md text-sm font-medium transition-colors';
        if (isActive(path)) {
            return `${base} bg-blue-600 text-white`;
        }
        return `${base} text-gray-700 hover:bg-gray-100 hover:text-gray-900`;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Header */}
            <header className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo/Title */}
                        <div className="flex items-center">
                            <h1 className="text-xl font-bold text-gray-900">StreamCraft TTS</h1>
                        </div>

                        {/* Navigation Links */}
                        <nav className="flex space-x-2">
                            <Link to="/jobs" className={linkClass('/jobs')}>
                                Jobs
                            </Link>
                            <Link to="/vods" className={linkClass('/vods')}>
                                VODs
                            </Link>
                            <Link to="/datasets" className={linkClass('/datasets')}>
                                Datasets
                            </Link>
                            <Link to="/audio" className={linkClass('/audio')}>
                                Audio
                            </Link>
                            <Link to="/settings" className={linkClass('/settings')}>
                                Settings
                            </Link>
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <p className="text-center text-sm text-gray-500">
                        StreamCraft TTS - VOD to TTS Dataset Pipeline
                    </p>
                </div>
            </footer>
        </div>
    );
};
