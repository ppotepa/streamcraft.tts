/**
 * VOD Search component
 * Search/input form for VOD URLs
 */

import React, { useState } from 'react';
import { VodSearchProps } from './vod-search.props';
import { parseVodUrl } from '../../../../domain/vod/utils/parse-vod-url';

export const VodSearch: React.FC<VodSearchProps> = ({
    onSearch,
    isLoading = false,
    placeholder = 'Enter Twitch or YouTube VOD URL...',
    value,
    onChange,
    showButton = true,
    showPlatformHints = true,
}) => {
    const [vodUrl, setVodUrl] = useState('');
    const inputValue = value ?? vodUrl;
    const parsedPlatform = showPlatformHints ? parseVodUrl(inputValue)?.platform : null;
    const platformLabel = parsedPlatform === 'twitch' ? 'Twitch' : parsedPlatform === 'youtube' ? 'YouTube' : null;
    const platformClassName =
        parsedPlatform === 'twitch'
            ? 'border-violet-400/50 bg-violet-500/10 text-violet-200 shadow-[0_0_18px_rgba(139,92,246,0.45)]'
            : parsedPlatform === 'youtube'
                ? 'border-rose-400/50 bg-rose-500/10 text-rose-200 shadow-[0_0_18px_rgba(244,63,94,0.45)]'
                : 'border-white/15 bg-white/5 text-slate-400';

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSearch(inputValue.trim());
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const nextValue = e.target.value;
        if (value === undefined) {
            setVodUrl(nextValue);
        }
        if (onChange) {
            onChange(nextValue);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="vod-search-form w-full">
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-transparent px-3 py-2 focus-within:ring-2 focus-within:ring-amber-300/40">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleChange}
                        placeholder={placeholder}
                        disabled={isLoading}
                        className="flex-1 bg-transparent text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    {showPlatformHints && (
                        <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                            <span
                                className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase ${platformClassName}`}
                            >
                                {platformLabel ?? 'Paste a VOD URL'}
                            </span>
                        </div>
                    )}
                </div>
                {showButton && (
                    <button
                        type="submit"
                        disabled={isLoading || !inputValue.trim()}
                        className="primary-btn px-6 py-3 font-semibold rounded-xl disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                    >
                        {isLoading ? 'Searching...' : 'Fetch Metadata'}
                    </button>
                )}
            </div>
        </form>
    );
};
