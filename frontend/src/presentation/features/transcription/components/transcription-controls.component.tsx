/**
 * Transcription Controls component
 * Form for configuring and starting transcription
 */

import React, { useState } from 'react';
import { TranscriptionControlsProps, TranscriptionOptions } from './transcription-controls.props';

export const TranscriptionControls: React.FC<TranscriptionControlsProps> = ({
    onStartTranscription,
    isTranscribing = false,
}) => {
    const [audioPath, setAudioPath] = useState('');
    const [model, setModel] = useState<'tiny' | 'base' | 'small' | 'medium' | 'large'>('base');
    const [language, setLanguage] = useState('');

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        if (audioPath.trim()) {
            const options: TranscriptionOptions = {
                model,
                language: language.trim() || undefined,
            };
            onStartTranscription(audioPath.trim(), options);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="transcription-controls space-y-4 bg-white border rounded-lg p-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Audio File Path
                </label>
                <input
                    type="text"
                    value={audioPath}
                    onChange={(e) => setAudioPath(e.target.value)}
                    placeholder="/path/to/audio.wav"
                    disabled={isTranscribing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    required
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Model Size
                    </label>
                    <select
                        value={model}
                        onChange={(e) => setModel(e.target.value as any)}
                        disabled={isTranscribing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                        <option value="tiny">Tiny (fastest)</option>
                        <option value="base">Base</option>
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large (most accurate)</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Language (optional)
                    </label>
                    <input
                        type="text"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        placeholder="en, es, fr, etc."
                        disabled={isTranscribing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isTranscribing || !audioPath.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
                {isTranscribing ? 'Transcribing...' : 'Start Transcription'}
            </button>
        </form>
    );
};
