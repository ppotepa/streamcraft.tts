/**
 * Pagination Component
 * Reusable pagination controls for lists and tables
 */

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    itemsPerPage?: number;
    totalItems?: number;
}

export const Pagination = ({
    currentPage,
    totalPages,
    onPageChange,
    itemsPerPage,
    totalItems,
}: PaginationProps) => {
    const getPageNumbers = (): (number | string)[] => {
        const pages: (number | string)[] = [];
        const maxVisible = 7;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    const handlePrevious = () => {
        if (currentPage > 1) onPageChange(currentPage - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) onPageChange(currentPage + 1);
    };

    return (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            {/* Mobile view */}
            <div className="flex flex-1 justify-between sm:hidden">
                <button
                    onClick={handlePrevious}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                <button
                    onClick={handleNext}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>

            {/* Desktop view */}
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm text-gray-700">
                        Showing{' '}
                        <span className="font-medium">
                            {itemsPerPage && totalItems
                                ? Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)
                                : currentPage}
                        </span>{' '}
                        to{' '}
                        <span className="font-medium">
                            {itemsPerPage && totalItems
                                ? Math.min(currentPage * itemsPerPage, totalItems)
                                : currentPage}
                        </span>{' '}
                        of <span className="font-medium">{totalItems || totalPages}</span>{' '}
                        {totalItems ? 'results' : 'pages'}
                    </p>
                </div>
                <div>
                    <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                        {/* Previous button */}
                        <button
                            onClick={handlePrevious}
                            disabled={currentPage === 1}
                            className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="sr-only">Previous</span>
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                    fillRule="evenodd"
                                    d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>

                        {/* Page numbers */}
                        {getPageNumbers().map((page, index) =>
                            typeof page === 'number' ? (
                                <button
                                    key={index}
                                    onClick={() => onPageChange(page)}
                                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === page
                                            ? 'z-10 bg-blue-600 text-white focus:z-20'
                                            : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20'
                                        }`}
                                >
                                    {page}
                                </button>
                            ) : (
                                <span
                                    key={index}
                                    className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300"
                                >
                                    {page}
                                </span>
                            )
                        )}

                        {/* Next button */}
                        <button
                            onClick={handleNext}
                            disabled={currentPage === totalPages}
                            className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="sr-only">Next</span>
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path
                                    fillRule="evenodd"
                                    d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    </nav>
                </div>
            </div>
        </div>
    );
};
