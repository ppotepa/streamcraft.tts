/**
 * Dataset Builder component
 * Interactive form for building datasets
 */

import React, { useState } from 'react';
import { DatasetBuilderProps } from './dataset-builder.props';
import { DatasetEntryTable } from './dataset-entry-table.component';
import { DatasetEntry } from './dataset-entry-table.props';

export const DatasetBuilder: React.FC<DatasetBuilderProps> = ({
    entries,
    onAddEntry,
    onRemoveEntry,
    onCreateDataset,
    isCreating = false,
}) => {
    const [datasetName, setDatasetName] = useState('');
    const [audioPath, setAudioPath] = useState('');
    const [text, setText] = useState('');
    const [duration, setDuration] = useState('');

    const handleAddEntry = (e: React.FormEvent): void => {
        e.preventDefault();
        if (audioPath.trim() && text.trim()) {
            const entry: DatasetEntry = {
                audioPath: audioPath.trim(),
                text: text.trim(),
                durationSeconds: duration ? parseFloat(duration) : undefined,
            };
            onAddEntry(entry);
            setAudioPath('');
            setText('');
            setDuration('');
        }
    };

    const handleCreateDataset = (): void => {
        if (datasetName.trim() && entries.length > 0) {
            onCreateDataset(datasetName.trim());
        }
    };

    const getTotalDuration = (): number => {
        return entries.reduce((sum, entry) => sum + (entry.durationSeconds || 0), 0);
    };

    return (
        <div className="dataset-builder space-y-6">
            {/* Dataset Info */}
            <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Dataset Information</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Dataset Name
                        </label>
                        <input
                            type="text"
                            value={datasetName}
                            onChange={(e) => setDatasetName(e.target.value)}
                            placeholder="My TTS Dataset"
                            disabled={isCreating}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>
                            <strong>{entries.length}</strong> entries
                        </span>
                        <span>
                            <strong>{getTotalDuration().toFixed(2)}s</strong> total duration
                        </span>
                    </div>
                </div>
            </div>

            {/* Add Entry Form */}
            <form onSubmit={handleAddEntry} className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Add Entry</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Audio Path
                        </label>
                        <input
                            type="text"
                            value={audioPath}
                            onChange={(e) => setAudioPath(e.target.value)}
                            placeholder="/path/to/audio.wav"
                            disabled={isCreating}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Text
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Transcription text..."
                            disabled={isCreating}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Duration (seconds, optional)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="3.5"
                            disabled={isCreating}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isCreating || !audioPath.trim() || !text.trim()}
                        className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        Add Entry
                    </button>
                </div>
            </form>

            {/* Entries Table */}
            <div className="bg-white border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">Dataset Entries</h3>
                <DatasetEntryTable
                    entries={entries}
                    onEntryDelete={onRemoveEntry}
                />
            </div>

            {/* Create Button */}
            <button
                onClick={handleCreateDataset}
                disabled={isCreating || !datasetName.trim() || entries.length === 0}
                className="w-full px-4 py-3 bg-blue-600 text-white font-semibold text-lg rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
                {isCreating ? 'Creating Dataset...' : 'Create Dataset'}
            </button>
        </div>
    );
};
