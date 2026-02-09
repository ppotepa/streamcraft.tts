/**
 * VOD Search component
 * Search/input form for VOD URLs
 */

import React, { useState } from 'react';
import { VodSearchProps } from './vod-search.props';

export const VodSearch: React.FC<VodSearchProps> = ({
    onSearch,
    isLoading = false,
    placeholder = 'Enter Twitch or YouTube VOD URL...',
}) => {
    const [vodUrl, setVodUrl] = useState('');

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        if (vodUrl.trim()) {
            onSearch(vodUrl.trim());
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        setVodUrl(e.target.value);
    };

    return (
        <form onSubmit={handleSubmit} className="vod-search-form w-full">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={vodUrl}
                    onChange={handleChange}
                    placeholder={placeholder}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
                <button
                    type="submit"
                    disabled={isLoading || !vodUrl.trim()}
                    className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? 'Searching...' : 'Fetch Metadata'}
                </button>
            </div>
        </form>
    );
};
