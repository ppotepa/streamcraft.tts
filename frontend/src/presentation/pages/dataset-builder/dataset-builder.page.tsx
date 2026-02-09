/**
 * Dataset Builder Page
 * Page for creating and managing datasets
 */

import React, { useState } from 'react';
import { DatasetBuilder } from '../../features/dataset-management';
import { DatasetEntry } from '../../features/dataset-management/components/dataset-entry-table.props';
import { useDependencies } from '../../context/dependency-context';
import { useCreateDataset } from '../../shared/hooks/use-create-dataset';

export const DatasetBuilderPage: React.FC = () => {
    const container = useDependencies();
    const createDatasetHandler = container.getCreateDatasetHandler();

    const {
        data: createdDataset,
        isLoading: isCreating,
        error: createError,
        execute: createDataset,
        reset: resetDataset,
    } = useCreateDataset(createDatasetHandler);

    const [entries, setEntries] = useState<readonly DatasetEntry[]>([]);

    const handleAddEntry = (entry: DatasetEntry): void => {
        setEntries([...entries, entry]);
    };

    const handleRemoveEntry = (index: number): void => {
        setEntries(entries.filter((_, i) => i !== index));
    };

    const handleCreateDataset = async (name: string): Promise<void> => {
        resetDataset();
        await createDataset(name, entries);
    };

    return (
        <div className="dataset-builder-page p-6">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    Dataset Builder
                </h1>

                {createError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-700 text-sm">{createError.message}</p>
                    </div>
                )}

                {createdDataset && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-700 font-medium">
                            Dataset created successfully!
                        </p>
                        <p className="text-green-600 text-sm mt-1">
                            Dataset ID: {createdDataset.datasetId}
                        </p>
                        <p className="text-green-600 text-sm">
                            Name: {createdDataset.name}
                        </p>
                        <p className="text-green-600 text-sm">
                            Total Entries: {createdDataset.totalEntries}
                        </p>
                    </div>
                )}

                <DatasetBuilder
                    entries={entries}
                    onAddEntry={handleAddEntry}
                    onRemoveEntry={handleRemoveEntry}
                    onCreateDataset={handleCreateDataset}
                    isCreating={isCreating}
                />
            </div>
        </div>
    );
};
