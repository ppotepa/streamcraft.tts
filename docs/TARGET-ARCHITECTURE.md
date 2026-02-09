# Target Architecture: Ultra-Typed, High-Granularity Clean Architecture

## Core Principles Applied

### Python Backend
- **Strict mypy compliance**: All functions explicitly typed, no `Any`
- **Value objects**: Frozen dataclasses with slots
- **Branded types**: NewType for IDs and domain primitives
- **Result types**: No exceptions for expected failures
- **ABC protocols**: For polymorphic contracts
- **Dependency inversion**: Pure domain, injected infrastructure

### TypeScript Frontend
- **Strict mode**: noImplicitAny, exactOptionalPropertyTypes, noUncheckedIndexedAccess
- **Branded types**: For IDs and domain primitives
- **Discriminated unions**: For variants and results
- **Result<T, E>**: Explicit error handling
- **Classes for contracts**: Abstract classes for polymorphism
- **Immutability**: readonly everywhere

### Architecture Rules
- **High granularity**: One responsibility per file/class
- **No inheritance**: Prefer composition and protocols
- **Layer isolation**: Domain → Application → Infrastructure
- **Explicit boundaries**: Ports and adapters pattern

---

## Target Directory Structure

```
streamcraft.tts/
├── backend/
│   ├── pyproject.toml                    # Strict mypy, ruff config
│   ├── pytest.ini
│   ├── mypy.ini                          # --strict mode
│   └── streamcraft/
│       ├── __init__.py
│       │
│       ├── domain/                       # Pure domain logic - NO dependencies
│       │   ├── __init__.py
│       │   │
│       │   ├── shared/                   # Shared domain primitives
│       │   │   ├── __init__.py
│       │   │   ├── branded_types.py      # JobId, VodId, SegmentId, UserId
│       │   │   ├── result.py             # Result[T, E], Success, Failure
│       │   │   ├── option.py             # Option[T], Some, Nothing
│       │   │   ├── value_objects.py      # Duration, Timestamp, AudioQuality
│       │   │   └── errors.py             # DomainError hierarchy
│       │   │
│       │   ├── vod/                      # VOD subdomain
│       │   │   ├── __init__.py
│       │   │   ├── entities/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── vod.py            # Vod entity (frozen dataclass)
│       │   │   │   └── vod_metadata.py   # VodMetadata value object
│       │   │   ├── value_objects/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── platform.py       # Platform enum (twitch/youtube)
│       │   │   │   ├── url.py            # VodUrl (validated)
│       │   │   │   └── quality.py        # VideoQuality enum
│       │   │   ├── errors/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── invalid_url.py
│       │   │   │   └── metadata_fetch_failed.py
│       │   │   └── ports/                # Interfaces this domain needs
│       │   │       ├── __init__.py
│       │   │       ├── vod_metadata_fetcher.py     # ABC protocol
│       │   │       └── vod_downloader.py            # ABC protocol
│       │   │
│       │   ├── audio/                    # Audio processing subdomain
│       │   │   ├── __init__.py
│       │   │   ├── entities/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── audio_file.py     # AudioFile entity
│       │   │   │   └── audio_segment.py  # AudioSegment entity
│       │   │   ├── value_objects/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── sample_rate.py    # SampleRate (16000, 48000)
│       │   │   │   ├── bit_depth.py      # BitDepth enum
│       │   │   │   ├── audio_format.py   # AudioFormat (wav, aac, pcm)
│       │   │   │   ├── rms_db.py         # RmsDb (validated float)
│       │   │   │   └── time_range.py     # TimeRange (start, end)
│       │   │   ├── errors/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── invalid_audio_format.py
│       │   │   │   ├── extraction_failed.py
│       │   │   │   └── segment_invalid.py
│       │   │   └── ports/
│       │   │       ├── __init__.py
│       │   │       ├── audio_extractor.py        # ABC
│       │   │       ├── audio_slicer.py           # ABC
│       │   │       └── audio_quality_analyzer.py # ABC
│       │   │
│       │   ├── transcription/            # Transcription subdomain
│       │   │   ├── __init__.py
│       │   │   ├── entities/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── transcript.py     # Transcript entity
│       │   │   │   └── cue.py            # Cue (with time codes)
│       │   │   ├── value_objects/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── transcript_text.py    # Validated text
│       │   │   │   ├── confidence_score.py   # 0.0-1.0
│       │   │   │   ├── language_code.py      # ISO language code
│       │   │   │   └── model_name.py         # WhisperModel enum
│       │   │   ├── errors/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── transcription_failed.py
│       │   │   │   └── invalid_subtitle_format.py
│       │   │   └── ports/
│       │   │       ├── __init__.py
│       │   │       ├── transcriber.py            # ABC
│       │   │       └── subtitle_parser.py        # ABC
│       │   │
│       │   ├── dataset/                  # Dataset subdomain
│       │   │   ├── __init__.py
│       │   │   ├── entities/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── dataset.py        # Dataset aggregate root
│       │   │   │   ├── dataset_entry.py  # Single entry
│       │   │   │   └── dataset_metadata.py
│       │   │   ├── value_objects/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── entry_path.py     # Validated file path
│       │   │   │   ├── dataset_format.py # csv, json, jsonl
│       │   │   │   └── split_ratio.py    # train/val/test ratios
│       │   │   ├── errors/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── dataset_creation_failed.py
│       │   │   │   └── invalid_entry.py
│       │   │   └── ports/
│       │   │       ├── __init__.py
│       │   │       ├── dataset_writer.py         # ABC
│       │   │       └── dataset_validator.py      # ABC
│       │   │
│       │   └── job/                      # Job management subdomain
│       │       ├── __init__.py
│       │       ├── entities/
│       │       │   ├── __init__.py
│       │       │   ├── job.py            # Job aggregate root
│       │       │   ├── job_step.py       # Individual step
│       │       │   └── job_log.py        # Log entry
│       │       ├── value_objects/
│       │       │   ├── __init__.py
│       │       │   ├── job_status.py     # JobStatus enum (idle/running/done/error)
│       │       │   ├── step_name.py      # StepName enum
│       │       │   ├── exit_code.py      # ExitCode (validated int)
│       │       │   └── log_message.py    # Validated log text
│       │       ├── errors/
│       │       │   ├── __init__.py
│       │       │   ├── job_not_found.py
│       │       │   ├── step_failed.py
│       │       │   └── invalid_transition.py
│       │       └── ports/
│       │           ├── __init__.py
│       │           ├── job_repository.py         # ABC
│       │           └── job_executor.py           # ABC
│       │
│       ├── application/                  # Use cases - orchestration layer
│       │   ├── __init__.py
│       │   │
│       │   ├── shared/                   # Shared application concerns
│       │   │   ├── __init__.py
│       │   │   ├── use_case.py           # UseCase[TInput, TOutput] protocol
│       │   │   ├── command.py            # Command base (marker)
│       │   │   ├── query.py              # Query base (marker)
│       │   │   └── unit_of_work.py       # UnitOfWork protocol
│       │   │
│       │   ├── vod/                      # VOD use cases
│       │   │   ├── __init__.py
│       │   │   ├── fetch_vod_metadata/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── command.py        # FetchVodMetadataCommand
│       │   │   │   ├── handler.py        # Handler with explicit dependencies
│       │   │   │   └── dto.py            # VodMetadataDto (output)
│       │   │   └── download_vod/
│       │   │       ├── __init__.py
│       │   │       ├── command.py
│       │   │       ├── handler.py
│       │   │       └── dto.py
│       │   │
│       │   ├── audio/
│       │   │   ├── __init__.py
│       │   │   ├── extract_audio/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── command.py        # ExtractAudioCommand
│       │   │   │   ├── handler.py
│       │   │   │   └── dto.py
│       │   │   ├── slice_audio_segments/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── command.py
│       │   │   │   ├── handler.py
│       │   │   │   └── dto.py
│       │   │   └── analyze_audio_quality/
│       │   │       ├── __init__.py
│       │   │       ├── query.py
│       │   │       ├── handler.py
│       │   │       └── dto.py
│       │   │
│       │   ├── transcription/
│       │   │   ├── __init__.py
│       │   │   ├── transcribe_audio/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── command.py
│       │   │   │   ├── handler.py
│       │   │   │   └── dto.py
│       │   │   └── parse_subtitles/
│       │   │       ├── __init__.py
│       │   │       ├── command.py
│       │   │       ├── handler.py
│       │   │       └── dto.py
│       │   │
│       │   ├── dataset/
│       │   │   ├── __init__.py
│       │   │   ├── create_dataset/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── command.py
│       │   │   │   ├── handler.py
│       │   │   │   └── dto.py
│       │   │   ├── validate_dataset/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── query.py
│       │   │   │   ├── handler.py
│       │   │   │   └── dto.py
│       │   │   └── export_dataset/
│       │   │       ├── __init__.py
│       │   │       ├── command.py
│       │   │       ├── handler.py
│       │   │       └── dto.py
│       │   │
│       │   └── job/
│       │       ├── __init__.py
│       │       ├── create_job/
│       │       │   ├── __init__.py
│       │       │   ├── command.py
│       │       │   ├── handler.py
│       │       │   └── dto.py
│       │       ├── execute_job_step/
│       │       │   ├── __init__.py
│       │       │   ├── command.py
│       │       │   ├── handler.py
│       │       │   └── dto.py
│       │       ├── get_job_status/
│       │       │   ├── __init__.py
│       │       │   ├── query.py
│       │       │   ├── handler.py
│       │       │   └── dto.py
│       │       └── list_jobs/
│       │           ├── __init__.py
│       │           ├── query.py
│       │           ├── handler.py
│       │           └── dto.py
│       │
│       ├── infrastructure/              # External adapters - framework/IO
│       │   ├── __init__.py
│       │   │
│       │   ├── shared/                 # Cross-cutting infrastructure
│       │   │   ├── __init__.py
│       │   │   ├── config/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── settings.py     # Pydantic settings
│       │   │   │   └── paths.py        # Path configuration
│       │   │   ├── logging/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── logger.py       # Structured logger
│       │   │   │   └── log_formatter.py
│       │   │   └── telemetry/
│       │   │       ├── __init__.py
│       │   │       └── metrics.py      # Optional metrics
│       │   │
│       │   ├── persistence/            # Data storage adapters
│       │   │   ├── __init__.py
│       │   │   ├── file_system/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── json_job_repository.py    # Implements JobRepository
│       │   │   │   ├── file_storage.py
│       │   │   │   └── path_resolver.py
│       │   │   └── memory/             # In-memory for testing
│       │   │       ├── __init__.py
│       │   │       └── memory_job_repository.py
│       │   │
│       │   ├── external_apis/          # Third-party API clients
│       │   │   ├── __init__.py
│       │   │   ├── twitch/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── client.py       # Twitch API client
│       │   │   │   ├── metadata_fetcher.py  # Implements VodMetadataFetcher
│       │   │   │   ├── downloader.py   # Implements VodDownloader
│       │   │   │   └── dto.py          # Twitch-specific DTOs
│       │   │   └── youtube/
│       │   │       ├── __init__.py
│       │   │       ├── client.py
│       │   │       ├── metadata_fetcher.py
│       │   │       └── downloader.py
│       │   │
│       │   ├── audio_processing/       # Audio tool adapters
│       │   │   ├── __init__.py
│       │   │   ├── ffmpeg/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── extractor.py    # Implements AudioExtractor
│       │   │   │   ├── slicer.py       # Implements AudioSlicer
│       │   │   │   ├── command_builder.py
│       │   │   │   └── output_parser.py
│       │   │   ├── demucs/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── separator.py    # Vocal separation
│       │   │   │   └── model_loader.py
│       │   │   └── soundfile/
│       │   │       ├── __init__.py
│       │   │       ├── analyzer.py     # Implements AudioQualityAnalyzer
│       │   │       └── reader.py
│       │   │
│       │   ├── transcription/          # Transcription adapters
│       │   │   ├── __init__.py
│       │   │   ├── faster_whisper/
│       │   │   │   ├── __init__.py
│       │   │   │   ├── transcriber.py  # Implements Transcriber
│       │   │   │   ├── model_loader.py
│       │   │   │   └── config.py
│       │   │   └── subtitle_parsers/
│       │   │       ├── __init__.py
│       │   │       ├── srt_parser.py   # Implements SubtitleParser
│       │   │       └── vtt_parser.py
│       │   │
│       │   └── web/                    # Web framework adapters
│       │       ├── __init__.py
│       │       ├── fastapi/
│       │       │   ├── __init__.py
│       │       │   ├── app.py          # FastAPI app factory
│       │       │   ├── dependencies.py # DI container
│       │       │   ├── middleware/
│       │       │   │   ├── __init__.py
│       │       │   │   ├── cors.py
│       │       │   │   ├── error_handler.py
│       │       │   │   └── logging.py
│       │       │   ├── routes/
│       │       │   │   ├── __init__.py
│       │       │   │   ├── health.py
│       │       │   │   ├── vod_routes.py
│       │       │   │   ├── audio_routes.py
│       │       │   │   ├── transcription_routes.py
│       │       │   │   ├── dataset_routes.py
│       │       │   │   └── job_routes.py
│       │       │   └── schemas/        # API request/response schemas
│       │       │       ├── __init__.py
│       │       │       ├── vod_schemas.py
│       │       │       ├── audio_schemas.py
│       │       │       ├── job_schemas.py
│       │       │       └── error_schemas.py
│       │       └── cli/
│       │           ├── __init__.py
│       │           ├── main.py
│       │           └── commands/
│       │               ├── __init__.py
│       │               ├── vod_command.py
│       │               ├── audio_command.py
│       │               └── dataset_command.py
│       │
│       └── shared/                     # True cross-cutting shared code
│           ├── __init__.py
│           ├── types/
│           │   ├── __init__.py
│           │   └── protocols.py        # Shared protocols/interfaces
│           └── utils/
│               ├── __init__.py
│               ├── text_sanitizer.py
│               ├── file_hasher.py
│               └── time_formatter.py
│
├── frontend/                           # TypeScript React frontend
│   ├── tsconfig.json                   # Strict mode enabled
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                     # Root composition
│       │
│       ├── domain/                     # Pure domain logic (no React, no HTTP)
│       │   ├── shared/
│       │   │   ├── branded-types.ts    # JobId, VodId, SegmentId
│       │   │   ├── result.ts           # Result<T, E>, Ok, Err
│       │   │   ├── option.ts           # Option<T>, Some, None
│       │   │   ├── value-objects.ts    # Duration, Timestamp classes
│       │   │   └── errors.ts           # DomainError hierarchy
│       │   │
│       │   ├── vod/
│       │   │   ├── entities/
│       │   │   │   ├── vod.entity.ts        # Vod class
│       │   │   │   └── vod-metadata.ts      # VodMetadata value object
│       │   │   ├── value-objects/
│       │   │   │   ├── platform.ts          # Platform enum
│       │   │   │   ├── vod-url.ts           # VodUrl (validated)
│       │   │   │   └── video-quality.ts
│       │   │   └── errors/
│       │   │       ├── invalid-vod-url.error.ts
│       │   │       └── metadata-fetch-failed.error.ts
│       │   │
│       │   ├── audio/
│       │   │   ├── entities/
│       │   │   │   ├── audio-file.entity.ts
│       │   │   │   └── audio-segment.entity.ts
│       │   │   ├── value-objects/
│       │   │   │   ├── sample-rate.ts
│       │   │   │   ├── audio-format.ts
│       │   │   │   ├── rms-db.ts
│       │   │   │   └── time-range.ts
│       │   │   └── errors/
│       │   │       ├── invalid-audio-format.error.ts
│       │   │       └── extraction-failed.error.ts
│       │   │
│       │   ├── transcription/
│       │   │   ├── entities/
│       │   │   │   ├── transcript.entity.ts
│       │   │   │   └── cue.entity.ts
│       │   │   ├── value-objects/
│       │   │   │   ├── transcript-text.ts
│       │   │   │   ├── confidence-score.ts
│       │   │   │   └── language-code.ts
│       │   │   └── errors/
│       │   │       └── transcription-failed.error.ts
│       │   │
│       │   ├── dataset/
│       │   │   ├── entities/
│       │   │   │   ├── dataset.entity.ts
│       │   │   │   └── dataset-entry.entity.ts
│       │   │   ├── value-objects/
│       │   │   │   ├── entry-path.ts
│       │   │   │   └── dataset-format.ts
│       │   │   └── errors/
│       │   │       └── dataset-creation-failed.error.ts
│       │   │
│       │   └── job/
│       │       ├── entities/
│       │       │   ├── job.entity.ts        # Job aggregate root
│       │       │   ├── job-step.entity.ts
│       │       │   └── job-log.entity.ts
│       │       ├── value-objects/
│       │       │   ├── job-status.ts        # Discriminated union
│       │       │   ├── step-name.ts         # Enum
│       │       │   └── exit-code.ts
│       │       └── errors/
│       │           ├── job-not-found.error.ts
│       │           └── step-failed.error.ts
│       │
│       ├── application/                # Use cases / business logic
│       │   ├── shared/
│       │   │   ├── use-case.ts         # UseCase<TInput, TOutput> abstract class
│       │   │   ├── command.ts          # Command marker
│       │   │   └── query.ts            # Query marker
│       │   │
│       │   ├── vod/
│       │   │   ├── fetch-vod-metadata/
│       │   │   │   ├── fetch-vod-metadata.command.ts
│       │   │   │   ├── fetch-vod-metadata.handler.ts
│       │   │   │   └── fetch-vod-metadata.dto.ts
│       │   │   └── download-vod/
│       │   │       └── ... (similar structure)
│       │   │
│       │   ├── audio/
│       │   │   ├── extract-audio/
│       │   │   │   ├── extract-audio.command.ts
│       │   │   │   ├── extract-audio.handler.ts
│       │   │   │   └── extract-audio.dto.ts
│       │   │   └── analyze-audio-quality/
│       │   │       └── ...
│       │   │
│       │   ├── transcription/
│       │   │   └── transcribe-audio/
│       │   │       └── ...
│       │   │
│       │   ├── dataset/
│       │   │   ├── create-dataset/
│       │   │   └── validate-dataset/
│       │   │
│       │   └── job/
│       │       ├── create-job/
│       │       ├── execute-job-step/
│       │       ├── get-job-status/
│       │       └── list-jobs/
│       │
│       ├── infrastructure/              # External concerns (HTTP, storage, etc)
│       │   ├── http/
│       │   │   ├── client/
│       │   │   │   ├── http-client.ts      # Abstract HTTP client
│       │   │   │   ├── fetch-client.ts     # Fetch implementation
│       │   │   │   └── axios-client.ts     # Alternative impl
│       │   │   ├── api/
│       │   │   │   ├── api-client.ts       # Main API client factory
│       │   │   │   ├── endpoints.ts        # API endpoint constants
│       │   │   │   └── interceptors/
│       │   │   │       ├── auth-interceptor.ts
│       │   │   │       ├── error-interceptor.ts
│       │   │   │       └── logging-interceptor.ts
│       │   │   └── repositories/           # HTTP-based repositories
│       │   │       ├── http-vod.repository.ts
│       │   │       ├── http-audio.repository.ts
│       │   │       ├── http-job.repository.ts
│       │   │       └── http-dataset.repository.ts
│       │   │
│       │   ├── storage/
│       │   │   ├── local-storage/
│       │   │   │   ├── local-storage.adapter.ts
│       │   │   │   ├── job-cache.ts
│       │   │   │   └── settings-storage.ts
│       │   │   └── memory/
│       │   │       └── memory-storage.adapter.ts
│       │   │
│       │   └── logging/
│       │       ├── console-logger.ts
│       │       └── logger.interface.ts
│       │
│       ├── presentation/                # UI layer (React components)
│       │   ├── shared/
│       │   │   ├── hooks/
│       │   │   │   ├── use-async-result.ts     # Hook for Result<T, E>
│       │   │   │   ├── use-debounce.ts
│       │   │   │   ├── use-media-query.ts
│       │   │   │   └── use-previous.ts
│       │   │   ├── components/
│       │   │   │   ├── data-display/
│       │   │   │   │   ├── badge/
│       │   │   │   │   │   ├── badge.component.tsx
│       │   │   │   │   │   ├── badge.props.ts
│       │   │   │   │   │   └── badge.styles.ts
│       │   │   │   │   ├── card/
│       │   │   │   │   │   └── ...
│       │   │   │   │   └── list/
│       │   │   │   │       └── ...
│       │   │   │   ├── forms/
│       │   │   │   │   ├── input/
│       │   │   │   │   ├── select/
│       │   │   │   │   ├── checkbox/
│       │   │   │   │   └── form/
│       │   │   │   ├── feedback/
│       │   │   │   │   ├── toast/
│       │   │   │   │   ├── spinner/
│       │   │   │   │   └── error-boundary/
│       │   │   │   ├── navigation/
│       │   │   │   │   ├── stepper/
│       │   │   │   │   ├── sidebar/
│       │   │   │   │   └── footer/
│       │   │   │   └── media/
│       │   │   │       ├── waveform/
│       │   │   │       ├── audio-player/
│       │   │   │       └── video-preview/
│       │   │   └── layouts/
│       │   │       ├── main-layout/
│       │   │       ├── wizard-layout/
│       │   │       └── empty-state-layout/
│       │   │
│       │   └── features/               # Feature-specific UI
│       │       ├── vod-management/
│       │       │   ├── components/
│       │       │   │   ├── vod-metadata-card/
│       │       │   │   │   ├── vod-metadata-card.component.tsx
│       │       │   │   │   ├── vod-metadata-card.props.ts
│       │       │   │   │   ├── vod-metadata-card.presenter.ts   # Pure logic
│       │       │   │   │   └── vod-metadata-card.styles.ts
│       │       │   │   ├── platform-badge/
│       │       │   │   └── vod-url-input/
│       │       │   ├── hooks/
│       │       │   │   ├── use-vod-metadata.ts
│       │       │   │   └── use-vod-download.ts
│       │       │   └── pages/
│       │       │       └── vod-selection.page.tsx
│       │       │
│       │       ├── audio-processing/
│       │       │   ├── components/
│       │       │   │   ├── audio-extract-section/
│       │       │   │   ├── audio-preview-card/
│       │       │   │   └── waveform-viewer/
│       │       │   ├── hooks/
│       │       │   │   ├── use-audio-extraction.ts
│       │       │   │   └── use-audio-analysis.ts
│       │       │   └── pages/
│       │       │       └── audio-processing.page.tsx
│       │       │
│       │       ├── segment-review/
│       │       │   ├── components/
│       │       │   │   ├── segment-list/
│       │       │   │   ├── segment-player/
│       │       │   │   ├── tinder-review/
│       │       │   │   └── segment-editor/
│       │       │   ├── hooks/
│       │       │   │   ├── use-segment-review.ts
│       │       │   │   └── use-segment-filter.ts
│       │       │   └── pages/
│       │       │       └── segment-review.page.tsx
│       │       │
│       │       ├── voice-lab/
│       │       │   ├── components/
│       │       │   │   ├── voice-selector/
│       │       │   │   ├── voice-preview/
│       │       │   │   └── tts-settings/
│       │       │   ├── hooks/
│       │       │   │   └── use-voice-synthesis.ts
│       │       │   └── pages/
│       │       │       └── voice-lab.page.tsx
│       │       │
│       │       ├── dataset-export/
│       │       │   ├── components/
│       │       │   │   ├── dataset-format-selector/
│       │       │   │   ├── export-settings/
│       │       │   │   └── dataset-preview/
│       │       │   ├── hooks/
│       │       │   │   └── use-dataset-export.ts
│       │       │   └── pages/
│       │       │       └── dataset-export.page.tsx
│       │       │
│       │       └── job-management/
│       │           ├── components/
│       │           │   ├── job-list/
│       │           │   ├── job-detail/
│       │           │   ├── job-status-card/
│       │           │   └── console-panel/
│       │           ├── hooks/
│       │           │   ├── use-job-list.ts
│       │           │   ├── use-job-status.ts
│       │           │   └── use-job-polling.ts
│       │           └── pages/
│       │               └── job-management.page.tsx
│       │
│       ├── state/                      # State management
│       │   ├── store/
│       │   │   ├── store.ts            # Root store setup
│       │   │   └── root-reducer.ts
│       │   ├── vod/
│       │   │   ├── vod.slice.ts
│       │   │   ├── vod.selectors.ts
│       │   │   └── vod.thunks.ts
│       │   ├── audio/
│       │   │   └── ...
│       │   ├── job/
│       │   │   └── ...
│       │   └── ui/
│       │       ├── wizard.slice.ts      # Wizard step state
│       │       └── toast.slice.ts
│       │
│       └── shared/                     # True cross-cutting concerns
│           ├── constants/
│           │   ├── routes.ts
│           │   ├── api-endpoints.ts
│           │   └── validation-rules.ts
│           ├── types/
│           │   ├── branded.ts          # Utility branded type helpers
│           │   └── utility-types.ts
│           └── utils/
│               ├── format-duration.ts
│               ├── format-timestamp.ts
│               └── sanitize-filename.ts
│
├── tests/                              # Tests mirror source structure
│   ├── backend/
│   │   ├── unit/
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   └── infrastructure/
│   │   ├── integration/
│   │   └── e2e/
│   └── frontend/
│       ├── unit/
│       │   ├── domain/
│       │   ├── application/
│       │   └── presentation/
│       ├── integration/
│       └── e2e/
│
├── docs/
│   ├── architecture/
│   │   ├── decisions/              # ADRs
│   │   ├── diagrams/
│   │   └── principles.md
│   ├── domain/
│   │   ├── glossary.md
│   │   └── bounded-contexts.md
│   └── development/
│       ├── setup.md
│       └── contributing.md
│
└── scripts/
    ├── build/
    ├── deploy/
    └── dev/
```

---

## Key Architectural Principles

### 1. **Dependency Rule**
```
domain ← application ← infrastructure
                    ← presentation
```
- Domain knows nothing about outer layers
- Application depends only on domain
- Infrastructure/Presentation depend on application + domain

### 2. **High Granularity**
- **One responsibility per file**: No "god classes" or "utility" modules
- **Explicit naming**: File names describe exact responsibility
- **Small interfaces**: Prefer many small protocols over large ones

### 3. **Strict Typing**

#### Python Example
```python
# domain/shared/branded_types.py
from typing import NewType

JobId = NewType('JobId', str)
VodId = NewType('VodId', str)
SegmentId = NewType('SegmentId', str)

# domain/shared/result.py
from dataclasses import dataclass
from typing import Generic, TypeVar, Callable

T = TypeVar('T')
E = TypeVar('E')

@dataclass(frozen=True, slots=True)
class Success(Generic[T]):
    value: T

@dataclass(frozen=True, slots=True)
class Failure(Generic[E]):
    error: E

Result = Success[T] | Failure[E]
```

#### TypeScript Example
```typescript
// domain/shared/branded-types.ts
declare const __brand: unique symbol;
type Brand<T, TBrand> = T & { [__brand]: TBrand };

export type JobId = Brand<string, 'JobId'>;
export type VodId = Brand<string, 'VodId'>;
export type SegmentId = Brand<string, 'SegmentId'>;

// domain/shared/result.ts
export type Result<T, E> = 
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const Ok = <T, E = never>(value: T): Result<T, E> => 
  ({ ok: true, value });

export const Err = <T = never, E = unknown>(error: E): Result<T, E> => 
  ({ ok: false, error });
```

### 4. **No Super Classes / Super Components**
- Use **composition** over inheritance
- Use **protocols/interfaces** for contracts
- Each component is **self-contained**

### 5. **Ports and Adapters**
- Domain defines **ports** (interfaces)
- Infrastructure provides **adapters** (implementations)
- Application **injects** adapters into use cases

---

## Migration Strategy

### Phase 1: Domain Layer (Pure Logic)
1. Extract value objects (branded types, enums)
2. Create entities (Job, Vod, AudioSegment, etc.)
3. Define domain errors
4. Define ports (abstract protocols)

### Phase 2: Application Layer (Use Cases)
1. Create use case handlers
2. Define DTOs for input/output
3. Implement command/query separation

### Phase 3: Infrastructure Layer (Adapters)
1. Implement repository adapters
2. Implement external API clients
3. Create web routes (FastAPI)
4. Create CLI commands

### Phase 4: Presentation Layer (React UI)
1. Migrate to feature-based structure
2. Separate presenters from components
3. Implement Result-based error handling
4. Add strict types everywhere

### Phase 5: Testing
1. Unit tests for domain (pure logic)
2. Integration tests for use cases
3. E2E tests for critical paths

---

## Type Safety Examples

### Python: Preventing Invalid States
```python
# domain/job/value_objects/job_status.py
from enum import Enum
from dataclasses import dataclass
from typing import Literal

class JobStatusKind(Enum):
    IDLE = "idle"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"

@dataclass(frozen=True, slots=True)
class IdleStatus:
    kind: Literal[JobStatusKind.IDLE]

@dataclass(frozen=True, slots=True)
class RunningStatus:
    kind: Literal[JobStatusKind.RUNNING]
    progress: float  # 0.0 to 1.0

@dataclass(frozen=True, slots=True)
class DoneStatus:
    kind: Literal[JobStatusKind.DONE]
    exit_code: int

@dataclass(frozen=True, slots=True)
class ErrorStatus:
    kind: Literal[JobStatusKind.ERROR]
    message: str

JobStatus = IdleStatus | RunningStatus | DoneStatus | ErrorStatus
```

### TypeScript: Discriminated Unions
```typescript
// domain/job/value-objects/job-status.ts
export enum JobStatusKind {
  Idle = 'idle',
  Running = 'running',
  Done = 'done',
  Error = 'error',
}

export type IdleStatus = {
  readonly kind: JobStatusKind.Idle;
};

export type RunningStatus = {
  readonly kind: JobStatusKind.Running;
  readonly progress: number; // 0-1
};

export type DoneStatus = {
  readonly kind: JobStatusKind.Done;
  readonly exitCode: number;
};

export type ErrorStatus = {
  readonly kind: JobStatusKind.Error;
  readonly message: string;
};

export type JobStatus = 
  | IdleStatus 
  | RunningStatus 
  | DoneStatus 
  | ErrorStatus;

// Type-safe exhaustive matching
export const matchJobStatus = <T>(
  status: JobStatus,
  matcher: {
    readonly idle: (s: IdleStatus) => T;
    readonly running: (s: RunningStatus) => T;
    readonly done: (s: DoneStatus) => T;
    readonly error: (s: ErrorStatus) => T;
  }
): T => {
  switch (status.kind) {
    case JobStatusKind.Idle: return matcher.idle(status);
    case JobStatusKind.Running: return matcher.running(status);
    case JobStatusKind.Done: return matcher.done(status);
    case JobStatusKind.Error: return matcher.error(status);
  }
};
```

---

## Configuration Files

### Backend: pyproject.toml
```toml
[tool.mypy]
strict = true
warn_unreachable = true
warn_unused_configs = true
disallow_any_unimported = true
disallow_any_expr = false
disallow_any_decorated = false
disallow_any_explicit = true
disallow_any_generics = true
disallow_subclassing_any = true
disallow_untyped_calls = true
disallow_untyped_defs = true
disallow_incomplete_defs = true
check_untyped_defs = true
disallow_untyped_decorators = true
no_implicit_optional = true
warn_redundant_casts = true
warn_unused_ignores = true
warn_return_any = true
no_implicit_reexport = true
strict_equality = true

[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "ANN", "B", "A", "COM", "C4", "DTZ", "T10", "ISC", "ICN", "G", "PIE", "PYI", "PT", "Q", "RSE", "RET", "SLF", "SIM", "TID", "TCH", "ARG", "PTH", "ERA", "PL", "TRY", "RUF"]
```

### Frontend: tsconfig.json
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

---

This architecture provides:
- ✅ **Maximum type safety** (no runtime surprises)
- ✅ **High testability** (pure functions, injected dependencies)
- ✅ **Clear boundaries** (domain isolation)
- ✅ **Scalability** (independent features)
- ✅ **Maintainability** (explicit responsibilities)
