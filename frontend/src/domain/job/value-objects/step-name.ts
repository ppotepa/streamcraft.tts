/**
 * Step name value object.
 */

export enum StepName {
    FetchMetadata = 'fetch_metadata',
    DownloadVod = 'download_vod',
    ExtractAudio = 'extract_audio',
    Transcribe = 'transcribe',
    ParseSubtitles = 'parse_subtitles',
    SliceSegments = 'slice_segments',
    AnalyzeQuality = 'analyze_quality',
    CreateDataset = 'create_dataset',
    Export = 'export',
}

export const getDisplayName = (stepName: StepName): string => {
    return stepName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export const allSteps = (): readonly StepName[] => {
    return Object.values(StepName);
};
