/**
 * Loading Skeleton Components
 * Provides loading states for various content types
 */

export const SkeletonCard = () => (
    <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        </div>
    </div>
);

export const SkeletonTable = ({ rows = 5 }: { rows?: number }) => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="animate-pulse">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <div className="flex space-x-4">
                    <div className="h-3 bg-gray-300 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                    <div className="h-3 bg-gray-300 rounded w-1/4"></div>
                </div>
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="px-6 py-4 border-b border-gray-100">
                    <div className="flex space-x-4">
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export const SkeletonList = ({ items = 3 }: { items?: number }) => (
    <div className="space-y-4">
        {Array.from({ length: items }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-md p-4 animate-pulse">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

export const SkeletonText = ({ lines = 3 }: { lines?: number }) => (
    <div className="space-y-2 animate-pulse">
        {Array.from({ length: lines }).map((_, i) => (
            <div
                key={i}
                className={`h-3 bg-gray-200 rounded ${i === lines - 1 ? 'w-5/6' : 'w-full'
                    }`}
            ></div>
        ))}
    </div>
);

export const SkeletonButton = () => (
    <div className="h-10 bg-gray-200 rounded-md w-24 animate-pulse"></div>
);

export const SkeletonImage = () => (
    <div className="w-full aspect-video bg-gray-200 rounded-lg animate-pulse"></div>
);

export const SkeletonGrid = ({ items = 6 }: { items?: number }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: items }).map((_, i) => (
            <SkeletonCard key={i} />
        ))}
    </div>
);
