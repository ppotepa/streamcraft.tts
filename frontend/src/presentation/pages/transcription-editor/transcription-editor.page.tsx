/**
 * Transcription Editor Page
 * Edit and refine transcript cues with timing adjustments
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDependencies } from '../../context/dependency-context';
import { useToast } from '../../shared/toast';
import { SkeletonTable } from '../../shared/loading';
import { Transcript } from '../../../domain/transcription/entities/transcript';
import { Cue } from '../../../domain/transcription/entities/cue';

export const TranscriptionEditorPage = () => {
    const { transcriptionId } = useParams<{ transcriptionId: string }>();
    const navigate = useNavigate();
    const { getGetTranscriptHandler } = useDependencies();
    const { showToast } = useToast();

    const [transcript, setTranscript] = useState<Transcript | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingCueIndex, setEditingCueIndex] = useState<number | null>(null);
    const [editText, setEditText] = useState('');

    useEffect(() => {
        if (!transcriptionId) return;

        const fetchTranscript = async () => {
            setLoading(true);

            const handler = getGetTranscriptHandler();
            const result = await handler.execute({ transcriptionId });

            if (result.isOk()) {
                setTranscript(result.value as Transcript);
            } else {
                showToast('error', `Failed to load transcript: ${result.error.message}`);
            }

            setLoading(false);
        };

        fetchTranscript();
    }, [transcriptionId, getGetTranscriptHandler, showToast]);

    const handleEditStart = (index: number, cue: Cue) => {
        setEditingCueIndex(index);
        setEditText(cue.text);
    };

    const handleEditSave = (index: number) => {
        if (!transcript) return;

        // Update cue text (in real app, would call update handler)
        const updatedCues = [...transcript.cues];
        updatedCues[index] = { ...updatedCues[index], text: editText };

        setTranscript({ ...transcript, cues: updatedCues });
        setEditingCueIndex(null);
        showToast('success', 'Cue updated successfully');
    };

    const handleEditCancel = () => {
        setEditingCueIndex(null);
        setEditText('');
    };

    const handleDeleteCue = (index: number) => {
        if (!transcript) return;

        if (window.confirm('Delete this cue?')) {
            const updatedCues = transcript.cues.filter((_, i) => i !== index);
            setTranscript({ ...transcript, cues: updatedCues });
            showToast('success', 'Cue deleted');
        }
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
    };

    if (loading) {
        return (
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    Transcription Editor
                </h1>
                <SkeletonTable rows={10} />
            </div>
        );
    }

    if (!transcript) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-800">Transcript not found</p>
                <button
                    onClick={() => navigate('/jobs')}
                    className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                >
                    Back to Jobs
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-600 hover:text-blue-700 flex items-center mb-2"
                    >
                        <span className="mr-2">←</span>
                        Back
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Transcription Editor
                    </h1>
                </div>

                <div className="text-sm text-gray-500">
                    {transcript.cues.length} cues
                </div>
            </div>

            {/* Transcript Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500">Model</label>
                        <p className="text-gray-900">{transcript.model}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500">Language</label>
                        <p className="text-gray-900">{transcript.language || 'Auto-detected'}</p>
                    </div>
                </div>
            </div>

            {/* Cues Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                #
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Time
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Duration
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Confidence
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Text
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {transcript.cues.map((cue, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-500">
                                    {index + 1}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                                    {formatTime(cue.startSeconds)} → {formatTime(cue.endSeconds)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                    {(cue.endSeconds - cue.startSeconds).toFixed(1)}s
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs ${!cue.confidence
                                                ? 'bg-gray-100 text-gray-600'
                                                : cue.confidence >= 0.8
                                                    ? 'bg-green-100 text-green-700'
                                                    : cue.confidence >= 0.5
                                                        ? 'bg-yellow-100 text-yellow-700'
                                                        : 'bg-red-100 text-red-700'
                                            }`}
                                    >
                                        {cue.confidence
                                            ? `${(cue.confidence * 100).toFixed(0)}%`
                                            : 'N/A'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                    {editingCueIndex === index ? (
                                        <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="w-full border border-gray-300 rounded p-2 text-sm"
                                            rows={2}
                                            autoFocus
                                        />
                                    ) : (
                                        <p className="text-gray-900">{cue.text}</p>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-right text-sm space-x-2">
                                    {editingCueIndex === index ? (
                                        <>
                                            <button
                                                onClick={() => handleEditSave(index)}
                                                className="text-green-600 hover:text-green-700 font-medium"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={handleEditCancel}
                                                className="text-gray-600 hover:text-gray-700 font-medium"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => handleEditStart(index, cue)}
                                                className="text-blue-600 hover:text-blue-700 font-medium"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteCue(index)}
                                                className="text-red-600 hover:text-red-700 font-medium"
                                            >
                                                Delete
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex space-x-4">
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        Export SRT
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        Export VTT
                    </button>
                    <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                        Export JSON
                    </button>
                </div>
            </div>
        </div>
    );
};
