/**
 * Dataset Entry Table component
 * Displays dataset entries in a table format
 */

import React from 'react';
import { DatasetEntryTableProps } from './dataset-entry-table.props';

export const DatasetEntryTable: React.FC<DatasetEntryTableProps> = ({
    entries,
    onEntryClick,
    onEntryDelete,
}) => {
    const formatDuration = (seconds: number | undefined): string => {
        if (seconds === undefined) return 'N/A';
        return `${seconds.toFixed(2)}s`;
    };

    const truncateText = (text: string, maxLength: number = 50): string => {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    if (entries.length === 0) {
        return (
            <div className="dataset-entry-table-empty flex items-center justify-center py-8 border rounded-lg bg-gray-50">
                <p className="text-gray-500 text-sm">No dataset entries</p>
            </div>
        );
    }

    return (
        <div className="dataset-entry-table overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Audio Path
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Text
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Duration
                        </th>
                        {onEntryDelete && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        )}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {entries.map((entry, index) => (
                        <tr
                            key={index}
                            onClick={() => onEntryClick?.(entry, index)}
                            className={`${onEntryClick ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                        >
                            <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                                {truncateText(entry.audioPath, 40)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                                {truncateText(entry.text)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                                {formatDuration(entry.durationSeconds)}
                            </td>
                            {onEntryDelete && (
                                <td className="px-4 py-3 text-sm">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEntryDelete(index);
                                        }}
                                        className="text-red-600 hover:text-red-800 font-medium"
                                    >
                                        Delete
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
