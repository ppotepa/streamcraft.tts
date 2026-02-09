/**
 * Audio Processing Page
 * Complete workflow: extract, analyze, slice, merge audio
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDependencies } from '../../context/dependency-context';
import { useToast } from '../../shared/toast';
import { AudioFile } from '../../../domain/audio/entities/audio-file';
import { AudioQualityMetrics } from '../../../domain/audio/entities/audio-quality-metrics';

type Step = 'extract' | 'analyze' | 'slice' | 'merge' | 'complete';

export const AudioProcessingPage = () => {
    const navigate = useNavigate();
    const container = useDependencies();
    const { showToast } = useToast();

    const [currentStep, setCurrentStep] = useState<Step>('extract');
    const [videoPath, setVideoPath] = useState('');
    const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
    const [qualityMetrics, setQualityMetrics] = useState<AudioQualityMetrics | null>(null);
    const [segments, setSegments] = useState<AudioFile[]>([]);
    const [mergedFile, setMergedFile] = useState<AudioFile | null>(null);
    const [loading, setLoading] = useState(false);

    // Extract audio from video
    const handleExtract = async () => {
        if (!videoPath.trim()) {
            showToast('error', 'Please enter a video path');
            return;
        }

        setLoading(true);

        try {
            const handler = container.getExtractAudioHandler();
            const result = await handler.execute({
                videoPath,
                outputPath: `./output/audio/${Date.now()}.wav`,
                format: 'wav',
                sampleRate: 44100,
            });

            if (result.isOk()) {
                const file = result.value as AudioFile;
                setAudioFile(file);
                setCurrentStep('analyze');
                showToast('success', `Audio extracted: ${file.path}`);
            } else {
                showToast('error', `Extraction failed: ${result.error.message}`);
            }
        } catch (error) {
            showToast('error', `Error: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    // Analyze audio quality
    const handleAnalyze = async () => {
        if (!audioFile) return;

        setLoading(true);

        try {
            const handler = container.getAnalyzeAudioQualityHandler();
            const result = await handler.execute({
                audioPath: audioFile.path.toString(),
            });

            if (result.isOk()) {
                const metrics = result.value as AudioQualityMetrics;
                setQualityMetrics(metrics);
                setCurrentStep('slice');
                showToast('success', 'Audio analyzed successfully');
            } else {
                showToast('error', `Analysis failed: ${result.error.message}`);
            }
        } catch (error) {
            showToast('error', `Error: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    // Slice audio (30-second segments)
    const handleSlice = async () => {
        if (!audioFile) return;

        setLoading(true);
        showToast('info', 'Slicing audio into 30-second segments...');

        try {
            const handler = container.getSliceAudioSegmentsHandler();
            const result = await handler.execute({
                audioPath: audioFile.path.toString(),
                outputDir: './output/segments',
                segmentDuration: 30.0,
                overlap: 0.0,
            });

            if (result.isOk()) {
                const files = result.value as AudioFile[];
                setSegments(files);
                setCurrentStep('merge');
                showToast('success', `Created ${files.length} segments`);
            } else {
                showToast('error', `Slice failed: ${result.error.message}`);
            }
        } catch (error) {
            showToast('error', `Error: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    // Merge audio segments
    const handleMerge = async () => {
        if (segments.length === 0) return;

        setLoading(true);
        showToast('info', 'Merging audio segments...');

        try {
            const handler = container.getMergeAudioSegmentsHandler();
            const result = await handler.execute({
                segmentPaths: segments.map((seg) => seg.path.toString()),
                outputPath: `./output/merged/${Date.now()}.wav`,
                format: 'wav',
                normalize: false,
            });

            if (result.isOk()) {
                const file = result.value as AudioFile;
                setMergedFile(file);
                setCurrentStep('complete');
                showToast('success', 'Audio merged successfully');
            } else {
                showToast('error', `Merge failed: ${result.error.message}`);
            }
        } catch (error) {
            showToast('error', `Error: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const renderStepIndicator = () => {
        const steps: { id: Step; label: string }[] = [
            { id: 'extract', label: 'Extract' },
            { id: 'analyze', label: 'Analyze' },
            { id: 'slice', label: 'Slice' },
            { id: 'merge', label: 'Merge' },
            { id: 'complete', label: 'Complete' },
        ];

        const currentIndex = steps.findIndex((s) => s.id === currentStep);

        return (
            <div className="flex items-center justify-between mb-8">
                {steps.map((step, index) => (
                    <div key={step.id} className="flex items-center">
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${index <= currentIndex
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                        >
                            {index + 1}
                        </div>
                        <span
                            className={`ml-2 text-sm font-medium ${index <= currentIndex ? 'text-blue-600' : 'text-gray-500'
                                }`}
                        >
                            {step.label}
                        </span>
                        {index < steps.length - 1 && (
                            <div
                                className={`w-16 h-1 mx-4 ${index < currentIndex ? 'bg-blue-600' : 'bg-gray-200'
                                    }`}
                            />
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <button
                    onClick={() => navigate('/jobs')}
                    className="text-blue-600 hover:text-blue-700 flex items-center mb-2"
                >
                    <span className="mr-2">←</span>
                    Back to Jobs
                </button>
                <h1 className="text-3xl font-bold text-gray-900">Audio Processing</h1>
                <p className="text-gray-600 mt-2">
                    Extract, analyze, slice, and merge audio files
                </p>
            </div>

            {/* Step Indicator */}
            {renderStepIndicator()}

            {/* Extract Step */}
            {currentStep === 'extract' && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Step 1: Extract Audio</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Video File Path
                            </label>
                            <input
                                type="text"
                                value={videoPath}
                                onChange={(e) => setVideoPath(e.target.value)}
                                placeholder="/path/to/video.mp4"
                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <button
                            onClick={handleExtract}
                            disabled={loading || !videoPath.trim()}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Extracting...' : 'Extract Audio'}
                        </button>
                    </div>
                </div>
            )}

            {/* Analyze Step */}
            {currentStep === 'analyze' && audioFile && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Step 2: Analyze Quality</h2>
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-md">
                            <p className="text-sm text-gray-600">
                                <strong>File:</strong> {audioFile.path.toString()}
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Duration:</strong> {audioFile.durationSeconds.toFixed(2)}s
                            </p>
                            <p className="text-sm text-gray-600">
                                <strong>Sample Rate:</strong> {audioFile.sampleRateHz} Hz
                            </p>
                        </div>
                        {qualityMetrics && (
                            <div className="bg-green-50 p-4 rounded-md">
                                <p className="text-sm text-green-800">
                                    <strong>RMS:</strong> {qualityMetrics.rmsDb.toFixed(2)} dB
                                </p>
                                <p className="text-sm text-green-800">
                                    <strong>Peak:</strong> {qualityMetrics.peakDb.toFixed(2)} dB
                                </p>
                            </div>
                        )}
                        <button
                            onClick={handleAnalyze}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                        >
                            {loading ? 'Analyzing...' : qualityMetrics ? 'Re-analyze' : 'Analyze'}
                        </button>
                    </div>
                </div>
            )}

            {/* Slice Step */}
            {currentStep === 'slice' && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Step 3: Slice Audio</h2>
                    {segments.length === 0 ? (
                        <button
                            onClick={handleSlice}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                        >
                            {loading ? 'Slicing...' : 'Slice into 30s Segments'}
                        </button>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600 mb-4">
                                Created {segments.length} segments:
                            </p>
                            {segments.map((seg, i) => (
                                <div key={i} className="bg-gray-50 p-3 rounded-md">
                                    <span className="text-sm font-medium">Segment {i + 1}</span>
                                    <span className="text-sm text-gray-600 ml-4">
                                        {seg.durationSeconds}s
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Merge Step */}
            {currentStep === 'merge' && segments.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Step 4: Merge Segments</h2>
                    <button
                        onClick={handleMerge}
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    >
                        {loading ? 'Merging...' : 'Merge All Segments'}
                    </button>
                </div>
            )}

            {/* Complete Step */}
            {currentStep === 'complete' && mergedFile && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4 text-green-600">
                        ✓ Processing Complete!
                    </h2>
                    <div className="bg-green-50 p-4 rounded-md space-y-2">
                        <p className="text-sm text-green-800">
                            <strong>Merged File:</strong> {mergedFile.path.toString()}
                        </p>
                        <p className="text-sm text-green-800">
                            <strong>Total Duration:</strong> {mergedFile.durationSeconds.toFixed(2)}s
                        </p>
                    </div>
                    <div className="mt-6 flex space-x-4">
                        <button
                            onClick={() => {
                                setCurrentStep('extract');
                                setVideoPath('');
                                setAudioFile(null);
                                setQualityMetrics(null);
                                setSegments([]);
                                setMergedFile(null);
                            }}
                            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            Process Another File
                        </button>
                        <button
                            onClick={() => navigate('/jobs')}
                            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                        >
                            Back to Jobs
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
