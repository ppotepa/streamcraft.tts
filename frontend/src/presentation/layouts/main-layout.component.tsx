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
        const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
        if (isActive(path)) {
            return `${base} bg-white/10 text-white border border-white/10`;
        }
        return `${base} text-slate-300 hover:bg-white/5 hover:text-white border border-transparent`;
    };

    return (
        <div className="app-shell">
            {/* Navigation Header */}
            <header className="sticky top-0 z-20 bg-black/40 backdrop-blur border-b border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* Logo/Title */}
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-blue-400"></div>
                            <div>
                                <h1 className="text-lg font-semibold text-white">StreamCraft TTS</h1>
                                <p className="text-xs text-slate-400">VOD to TTS Dataset Studio</p>
                            </div>
                        </div>

                        {/* Navigation Links */}
                        <nav className="flex flex-wrap gap-2">
                            <Link to="/wizard" className={linkClass('/wizard')}>
                                Wizard
                            </Link>
                            <Link to="/review" className={linkClass('/review')}>
                                Review
                            </Link>
                            <Link to="/jobs" className={linkClass('/jobs')}>
                                Jobs
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
            <footer className="border-t border-white/10 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <p className="text-center text-xs text-slate-500">
                        StreamCraft TTS - VOD to TTS Dataset Pipeline
                    </p>
                </div>
            </footer>
        </div>
    );
};
