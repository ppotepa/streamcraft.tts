/**
 * Settings Page
 * Application configuration and preferences
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../shared/toast';

interface Settings {
    apiBaseUrl: string;
    defaultModel: string;
    defaultSampleRate: number;
    defaultAudioFormat: string;
    autoAnalyze: boolean;
    darkMode: boolean;
}

export const SettingsPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [settings, setSettings] = useState<Settings>({
        apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
        defaultModel: 'whisper-base',
        defaultSampleRate: 44100,
        defaultAudioFormat: 'wav',
        autoAnalyze: true,
        darkMode: false,
    });

    const [hasChanges, setHasChanges] = useState(false);

    const handleChange = (key: keyof Settings, value: any) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = () => {
        // In real app, save to localStorage or API
        localStorage.setItem('streamcraft-settings', JSON.stringify(settings));
        showToast('success', 'Settings saved successfully');
        setHasChanges(false);
    };

    const handleReset = () => {
        const defaults: Settings = {
            apiBaseUrl: '/api',
            defaultModel: 'whisper-base',
            defaultSampleRate: 44100,
            defaultAudioFormat: 'wav',
            autoAnalyze: true,
            darkMode: false,
        };
        setSettings(defaults);
        setHasChanges(true);
        showToast('info', 'Settings reset to defaults');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate(-1)}
                    className="text-blue-600 hover:text-blue-700 flex items-center mb-2"
                >
                    <span className="mr-2">←</span>
                    Back
                </button>
                <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                <p className="text-gray-600 mt-2">Configure application preferences</p>
            </div>

            {/* API Settings */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">API Configuration</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            API Base URL
                        </label>
                        <input
                            type="text"
                            value={settings.apiBaseUrl}
                            onChange={(e) => handleChange('apiBaseUrl', e.target.value)}
                            placeholder="http://localhost:8000/api"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Backend API endpoint (leave as /api for dev proxy)
                        </p>
                    </div>
                </div>
            </div>

            {/* Transcription Settings */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">
                    Transcription Settings
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Default Whisper Model
                        </label>
                        <select
                            value={settings.defaultModel}
                            onChange={(e) => handleChange('defaultModel', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="whisper-tiny">Tiny (fastest)</option>
                            <option value="whisper-base">Base (balanced)</option>
                            <option value="whisper-small">Small (good quality)</option>
                            <option value="whisper-medium">Medium (high quality)</option>
                            <option value="whisper-large-v3">Large-V3 (best quality)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Larger models provide better accuracy but are slower
                        </p>
                    </div>
                </div>
            </div>

            {/* Audio Settings */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Audio Settings</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Default Sample Rate
                        </label>
                        <select
                            value={settings.defaultSampleRate}
                            onChange={(e) =>
                                handleChange('defaultSampleRate', parseInt(e.target.value))
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="16000">16000 Hz (speech)</option>
                            <option value="22050">22050 Hz (voice)</option>
                            <option value="44100">44100 Hz (CD quality)</option>
                            <option value="48000">48000 Hz (pro audio)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Default Audio Format
                        </label>
                        <select
                            value={settings.defaultAudioFormat}
                            onChange={(e) => handleChange('defaultAudioFormat', e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="wav">WAV (uncompressed)</option>
                            <option value="mp3">MP3 (compressed)</option>
                            <option value="m4a">M4A (AAC)</option>
                        </select>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="autoAnalyze"
                            checked={settings.autoAnalyze}
                            onChange={(e) => handleChange('autoAnalyze', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="autoAnalyze" className="ml-2 text-sm text-gray-700">
                            Automatically analyze audio quality after extraction
                        </label>
                    </div>
                </div>
            </div>

            {/* Appearance Settings */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 text-gray-900">Appearance</h2>
                <div className="space-y-4">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="darkMode"
                            checked={settings.darkMode}
                            onChange={(e) => handleChange('darkMode', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="darkMode" className="ml-2 text-sm text-gray-700">
                            Dark mode (coming soon)
                        </label>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between">
                    <button
                        onClick={handleReset}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                        Reset to Defaults
                    </button>

                    <div className="flex space-x-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!hasChanges}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>

                {hasChanges && (
                    <p className="text-sm text-yellow-600 mt-4">
                        ⚠️ You have unsaved changes
                    </p>
                )}
            </div>
        </div>
    );
};
