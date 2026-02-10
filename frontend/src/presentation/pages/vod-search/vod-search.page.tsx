/**
 * VOD Search Page
 * Page for searching and creating jobs from VOD URLs
 */

import React, { useState } from 'react';
import { VodSearch, VodMetadataCard } from '../../features/vod-management';
import { useDependencies } from '../../context/dependency-context';
import { useFetchVodMetadata } from '../../shared/hooks/use-fetch-vod-metadata';
import { useCreateJob } from '../../shared/hooks/use-create-job';
import { parseVodUrl } from '../../../domain/vod/utils/parse-vod-url';

export const VodSearchPage: React.FC = () => {
    const container = useDependencies();
    const fetchMetadataHandler = container.getFetchVodMetadataHandler();
    const createJobHandler = container.getCreateJobHandler();

    const {
        data: metadata,
        isLoading: isFetching,
        error: fetchError,
        execute: fetchMetadata,
        reset: resetMetadata,
    } = useFetchVodMetadata(fetchMetadataHandler);

    const {
        data: job,
        isLoading: isCreating,
        error: createError,
        execute: createJob,
        reset: resetJob,
    } = useCreateJob(createJobHandler);

    const [vodUrl, setVodUrl] = useState('');

    const handleSearch = async (url: string): Promise<void> => {
        setVodUrl(url);
        resetMetadata();
        resetJob();

        // Parse VOD URL to extract ID and platform
        const parsed = parseVodUrl(url);
        if (!parsed) {
            // TODO: Show error toast
            console.error('Invalid VOD URL');
            return;
        }

        await fetchMetadata(parsed.vodId, parsed.platform);
    };

    const handleCreateJob = async (vodId: string): Promise<void> => {
        await createJob(vodUrl);
    };

    return (
        <div className="vod-search-page p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    VOD Search & Job Creation
                </h1>

                <div className="mb-8">
                    <VodSearch onSearch={handleSearch} isLoading={isFetching} />
                </div>

                {fetchError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 text-sm">{fetchError.message}</p>
                    </div>
                )}

                {createError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 text-sm">{createError.message}</p>
                    </div>
                )}

                {job && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-700 font-medium">Job created successfully!</p>
                        <p className="text-green-600 text-sm mt-1">Job ID: {job.jobId}</p>
                    </div>
                )}

                {metadata && (
                    <div className="mt-8">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            VOD Metadata
                        </h2>
                        <VodMetadataCard
                            vodId={metadata.vodId}
                            streamer={metadata.streamer}
                            title={metadata.title}
                            durationSeconds={metadata.durationSeconds}
                            previewUrl={metadata.previewUrl}
                            platform={metadata.platform}
                            description={metadata.description}
                            url={metadata.url}
                            viewCount={metadata.viewCount}
                            createdAt={metadata.createdAt}
                            publishedAt={metadata.publishedAt}
                            language={metadata.language}
                            userLogin={metadata.userLogin}
                            videoType={metadata.videoType}
                            gameName={metadata.gameName}
                            onCreateJob={handleCreateJob}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
