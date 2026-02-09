/**
 * Audio Extraction Form component
 * Form for configuring audio extraction from video
 */

import React, { useState } from 'react';
import { AudioExtractionFormProps, AudioExtractionOptions } from './audio-extraction-form.props';

export const AudioExtractionForm: React.FC<AudioExtractionFormProps> = ({
    onExtract,
    isLoading = false,
}) => {
    const [videoPath, setVideoPath] = useState('');
    const [outputPath, setOutputPath] = useState('');
    const [format, setFormat] = useState<'wav' | 'mp3'>('wav');
    const [sampleRate, setSampleRate] = useState(16000);

    const handleSubmit = (e: React.FormEvent): void => {
        e.preventDefault();
        if (videoPath.trim() && outputPath.trim()) {
            const options: AudioExtractionOptions = {
                format,
                sampleRate,
            };
            onExtract(videoPath.trim(), outputPath.trim(), options);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="audio-extraction-form space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Video Path
                </label>
                <input
                    type="text"
                    value={videoPath}
                    onChange={(e) => setVideoPath(e.target.value)}
                    placeholder="/path/to/video.mp4"
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Output Path
                </label>
                <input
                    type="text"
                    value={outputPath}
                    onChange={(e) => setOutputPath(e.target.value)}
                    placeholder="/path/to/audio.wav"
                    disabled={isLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    required
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Format
                    </label>
                    <select
                        value={format}
                        onChange={(e) => setFormat(e.target.value as 'wav' | 'mp3')}
                        disabled={isLoading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                        <option value="wav">WAV</option>
                        <option value="mp3">MP3</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sample Rate (Hz)
                    </label>
                    <select
                        value={sampleRate}
                        onChange={(e) => setSampleRate(Number(e.target.value))}
                        disabled={isLoading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                    >
                        <option value={8000}>8000</option>
                        <option value={16000}>16000</option>
                        <option value={22050}>22050</option>
                        <option value={44100}>44100</option>
                        <option value={48000}>48000</option>
                    </select>
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading || !videoPath.trim() || !outputPath.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
                {isLoading ? 'Extracting...' : 'Extract Audio'}
            </button>
        </form>
    );
};
