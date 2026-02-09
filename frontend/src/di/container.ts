/**
 * Dependency Injection Container
 * Configures and provides all application dependencies
 */

import { FetchClient } from '../infrastructure/http/client/fetch-client';
import { HttpJobRepository } from '../infrastructure/http/repositories/http-job-repository';
import { HttpVodMetadataFetcher } from '../infrastructure/http/repositories/http-vod-metadata-fetcher';
import { HttpTranscriptionRepository } from '../infrastructure/http/repositories/http-transcription-repository';
import { HttpDatasetRepository } from '../infrastructure/http/repositories/http-dataset-repository';
import {
    HttpAudioExtractor,
    HttpAudioQualityAnalyzer,
    HttpTranscriber,
    HttpDatasetWriter,
} from '../infrastructure/http/adapters';
import { config } from '../config';

// Use case handlers - Job
import { CreateJobHandler } from '../application/job/create-job';
import { GetJobStatusHandler } from '../application/job/get-job-status';
import { ListJobsHandler } from '../application/job/list-jobs';
import { StartJobStepHandler } from '../application/job/start-job-step';
import { CompleteJobStepHandler } from '../application/job/complete-job-step';

// Use case handlers - VOD
import { FetchVodMetadataHandler } from '../application/vod/fetch-vod-metadata';

// Use case handlers - Audio
import { ExtractAudioHandler } from '../application/audio/extract-audio';
import { AnalyzeAudioQualityHandler } from '../application/audio/analyze-audio-quality';

// Use case handlers - Transcription
import { TranscribeAudioHandler } from '../application/transcription/transcribe-audio';
import { GetTranscriptHandler } from '../application/transcription/get-transcript';

// Use case handlers - Dataset
import { CreateDatasetHandler } from '../application/dataset/create-dataset';
import { ExportDatasetHandler } from '../application/dataset/export-dataset';

export class DependencyContainer {
    private static instance: DependencyContainer;

    // Infrastructure
    private httpClient: FetchClient;
    private jobRepository: HttpJobRepository;
    private vodMetadataFetcher: HttpVodMetadataFetcher;
    private transcriptionRepository: HttpTranscriptionRepository;
    private datasetRepository: HttpDatasetRepository;
    private audioExtractor: HttpAudioExtractor;
    private audioQualityAnalyzer: HttpAudioQualityAnalyzer;
    private transcriber: HttpTranscriber;
    private datasetWriter: HttpDatasetWriter;

    // Use case handlers
    private createJobHandler: CreateJobHandler;
    private getJobStatusHandler: GetJobStatusHandler;
    private listJobsHandler: ListJobsHandler;
    private startJobStepHandler: StartJobStepHandler;
    private completeJobStepHandler: CompleteJobStepHandler;
    private fetchVodMetadataHandler: FetchVodMetadataHandler;
    private extractAudioHandler: ExtractAudioHandler;
    private analyzeAudioQualityHandler: AnalyzeAudioQualityHandler;
    private transcribeAudioHandler: TranscribeAudioHandler;
    private getTranscriptHandler: GetTranscriptHandler;
    private createDatasetHandler: CreateDatasetHandler;
    private exportDatasetHandler: ExportDatasetHandler;

    private constructor(baseUrl: string = config.apiBaseUrl) {
        // Initialize infrastructure
        this.httpClient = new FetchClient(baseUrl);
        this.jobRepository = new HttpJobRepository(this.httpClient);
        this.vodMetadataFetcher = new HttpVodMetadataFetcher(this.httpClient);
        this.transcriptionRepository = new HttpTranscriptionRepository(
            this.httpClient
        );
        this.datasetRepository = new HttpDatasetRepository(this.httpClient);
        this.audioExtractor = new HttpAudioExtractor(this.httpClient);
        this.audioQualityAnalyzer = new HttpAudioQualityAnalyzer(this.httpClient);
        this.transcriber = new HttpTranscriber(this.httpClient);
        this.datasetWriter = new HttpDatasetWriter(this.httpClient);

        // Initialize use case handlers
        this.createJobHandler = new CreateJobHandler(this.jobRepository);
        this.getJobStatusHandler = new GetJobStatusHandler(this.jobRepository);
        this.listJobsHandler = new ListJobsHandler(this.jobRepository);
        this.startJobStepHandler = new StartJobStepHandler(this.jobRepository);
        this.completeJobStepHandler = new CompleteJobStepHandler(
            this.jobRepository
        );
        this.fetchVodMetadataHandler = new FetchVodMetadataHandler(
            this.vodMetadataFetcher
        );
        this.extractAudioHandler = new ExtractAudioHandler(this.audioExtractor);
        this.analyzeAudioQualityHandler = new AnalyzeAudioQualityHandler(
            this.audioQualityAnalyzer
        );
        this.transcribeAudioHandler = new TranscribeAudioHandler(this.transcriber);
        this.getTranscriptHandler = new GetTranscriptHandler(
            this.transcriptionRepository
        );
        this.createDatasetHandler = new CreateDatasetHandler(
            this.datasetRepository
        );
        this.exportDatasetHandler = new ExportDatasetHandler(
            this.datasetRepository,
            this.datasetWriter
        );
    }

    static getInstance(baseUrl?: string): DependencyContainer {
        if (!DependencyContainer.instance) {
            DependencyContainer.instance = new DependencyContainer(baseUrl);
        }
        return DependencyContainer.instance;
    }

    // Job handlers
    getCreateJobHandler(): CreateJobHandler {
        return this.createJobHandler;
    }

    getGetJobStatusHandler(): GetJobStatusHandler {
        return this.getJobStatusHandler;
    }

    getListJobsHandler(): ListJobsHandler {
        return this.listJobsHandler;
    }

    getStartJobStepHandler(): StartJobStepHandler {
        return this.startJobStepHandler;
    }

    getCompleteJobStepHandler(): CompleteJobStepHandler {
        return this.completeJobStepHandler;
    }

    // VOD handlers
    getFetchVodMetadataHandler(): FetchVodMetadataHandler {
        return this.fetchVodMetadataHandler;
    }

    // Audio handlers
    getExtractAudioHandler(): ExtractAudioHandler {
        return this.extractAudioHandler;
    }

    getAnalyzeAudioQualityHandler(): AnalyzeAudioQualityHandler {
        return this.analyzeAudioQualityHandler;
    }

    // Transcription handlers
    getTranscribeAudioHandler(): TranscribeAudioHandler {
        return this.transcribeAudioHandler;
    }

    getGetTranscriptHandler(): GetTranscriptHandler {
        return this.getTranscriptHandler;
    }

    // Dataset handlers
    getCreateDatasetHandler(): CreateDatasetHandler {
        return this.createDatasetHandler;
    }

    getExportDatasetHandler(): ExportDatasetHandler {
        return this.exportDatasetHandler;
    }
}
