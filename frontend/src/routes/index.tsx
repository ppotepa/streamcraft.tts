/**
 * Application Routes Configuration
 * Defines all routes and their corresponding page components
 */

import { RouteObject } from 'react-router-dom';
import { JobDashboardPage } from '../presentation/pages/job-dashboard/job-dashboard.page';
import { JobDetailsPage } from '../presentation/pages/job-details/job-details.page';
import { VodSearchPage } from '../presentation/pages/vod-search/vod-search.page';
import { DatasetsBrowserPage } from '../presentation/pages/datasets-browser/datasets-browser.page';
import { TranscriptionEditorPage } from '../presentation/pages/transcription-editor/transcription-editor.page';
import { AudioProcessingPage } from '../presentation/pages/audio-processing/audio-processing.page';
import { SettingsPage } from '../presentation/pages/settings/settings.page';
import { WizardPage } from '../presentation/pages/wizard/wizard.page';
import { ManualReviewPage } from '../presentation/pages/manual-review/manual-review.page';
import { TtsPage } from '../presentation/pages/tts/tts.page';

export const routes: RouteObject[] = [
    {
        path: '/',
        element: <WizardPage />,
    },
    {
        path: '/wizard',
        element: <WizardPage />,
    },
    {
        path: '/review',
        element: <ManualReviewPage />,
    },
    {
        path: '/jobs',
        element: <JobDashboardPage />,
    },
    {
        path: '/jobs/:jobId',
        element: <JobDetailsPage />,
    },
    {
        path: '/vods',
        element: <VodSearchPage />,
    },
    {
        path: '/datasets',
        element: <DatasetsBrowserPage />,
    },
    {
        path: '/tts',
        element: <TtsPage />,
    },
    {
        path: '/transcriptions/:transcriptionId',
        element: <TranscriptionEditorPage />,
    },
    {
        path: '/audio',
        element: <AudioProcessingPage />,
    },
    {
        path: '/settings',
        element: <SettingsPage />,
    },
];