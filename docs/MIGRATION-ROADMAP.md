# Migration Roadmap: Refactoring to Ultra-Typed Architecture

## Overview

This roadmap provides a systematic approach to migrate the existing Streamcraft TTS codebase to the ultra-typed clean architecture. The migration is designed to be incremental, allowing the system to remain functional throughout the process.

---

## Migration Phases

### Phase 1: Foundation (Week 1-2)

**Goal**: Establish core infrastructure without breaking existing code.

#### Python Backend

- [x] Add strict mypy configuration (`mypy.ini`)
- [x] Update `pyproject.toml` with strict linting rules
- [x] Create domain/shared primitives:
  - [x] `branded_types.py` - Type-safe IDs
  - [x] `result.py` - Result type
  - [x] `errors.py` - Domain errors
  - [x] `value_objects.py` - Common value objects
- [ ] Run mypy on new modules only: `mypy streamcraft/domain`
- [ ] Fix any type errors in new code

#### TypeScript Frontend

- [x] Create `tsconfig.strict.json` with ultra-strict settings
- [x] Create domain/shared primitives:
  - [x] `branded-types.ts`
  - [x] `result.ts`
  - [x] `errors.ts`
  - [x] `value-objects.ts`
- [ ] Run TypeScript on new modules: `tsc --noEmit`
- [ ] Fix any type errors in new code

**Deliverable**: Core type system working alongside existing code.

---

### Phase 2: Domain Layer (Week 3-4)

**Goal**: Extract domain logic into pure, typed entities and value objects.

#### Job Domain

**Python:**
```
backend/streamcraft/domain/job/
├── entities/
│   └── job.py ✅
├── value_objects/
│   ├── job_status.py ✅
│   └── step_name.py ✅
├── errors/
│   └── job_errors.py ✅
└── ports/
    └── job_repository.py ✅
```

**TypeScript:**
```
frontend/src/domain/job/
├── entities/
│   └── job.entity.ts ✅
├── value_objects/
│   ├── job-status.ts ✅
│   └── step-name.ts ✅
├── errors/
│   └── job-errors.ts ✅
└── ports/
    └── job-repository.ts ✅
```

**Tasks:**
- [ ] Extract job state machine logic from `backend/streamcraft/jobs/storage.py`
- [ ] Create Job entity with business rules
- [ ] Define JobStatus discriminated union
- [ ] Create JobRepository port (interface)
- [ ] Write unit tests for Job entity
- [ ] Repeat for frontend TypeScript
- [ ] Do NOT modify existing code yet - just create parallel structure

#### VOD Domain

**Python:**
```
backend/streamcraft/domain/vod/
├── entities/
│   └── vod.py ✅
├── value_objects/
│   ├── platform.py ✅
│   ├── vod_url.py ✅
│   └── vod_metadata.py ✅
├── errors/
│   └── vod_errors.py ✅
└── ports/
    └── vod_metadata_fetcher.py ✅
```

**TypeScript:**
```
frontend/src/domain/vod/
├── value_objects/
│   ├── platform.ts ✅
│   └── vod-url.ts ✅
└── errors/
    └── vod-errors.ts (create)
```

**Tasks:**
- [ ] Extract VOD validation from `backend/streamcraft/core/pipeline.py`
- [ ] Create VodUrl value object with platform detection
- [ ] Create VodMetadata value object
- [ ] Define VodMetadataFetcher port
- [ ] Write unit tests
- [ ] Repeat for frontend

#### Audio Domain

**Python:**
```
backend/streamcraft/domain/audio/
├── entities/
│   ├── audio_file.py (create)
│   └── audio_segment.py (create)
├── value_objects/
│   ├── sample_rate.py (create)
│   ├── audio_format.py (create)
│   └── time_range.py (create)
├── errors/
│   └── audio_errors.py (create)
└── ports/
    ├── audio_extractor.py (create)
    ├── audio_slicer.py (create)
    └── audio_analyzer.py (create)
```

**Tasks:**
- [ ] Extract audio logic from `backend/streamcraft/core/dataset.py`
- [ ] Create AudioSegment entity
- [ ] Create TimeRange value object
- [ ] Define audio processing ports
- [ ] Write unit tests

#### Dataset Domain

**Python:**
```
backend/streamcraft/domain/dataset/
├── entities/
│   ├── dataset.py (create)
│   └── dataset_entry.py (create)
├── value_objects/
│   ├── dataset_format.py (create)
│   └── entry_path.py (create)
├── errors/
│   └── dataset_errors.py (create)
└── ports/
    └── dataset_writer.py (create)
```

**Tasks:**
- [ ] Extract dataset logic
- [ ] Create Dataset aggregate
- [ ] Define dataset ports
- [ ] Write unit tests

**Deliverable**: Complete domain layer with 80%+ test coverage.

---

### Phase 3: Application Layer (Week 5-6)

**Goal**: Create use case handlers that orchestrate domain operations.

#### Create Use Cases

**Python:**
```
backend/streamcraft/application/
├── shared/
│   └── use_case.py ✅
├── job/
│   ├── create_job/ ✅
│   │   ├── command.py
│   │   ├── handler.py
│   │   └── dto.py
│   ├── start_job_step/ (create)
│   ├── get_job_status/ (create)
│   └── list_jobs/ (create)
├── vod/
│   └── fetch_vod_metadata/ (create)
├── audio/
│   ├── extract_audio/ (create)
│   └── slice_audio_segments/ (create)
└── dataset/
    └── create_dataset/ (create)
```

**TypeScript:**
```
frontend/src/application/
├── shared/
│   └── use-case.ts ✅
├── job/
│   └── create-job/ ✅
├── vod/
│   └── fetch-vod-metadata/ (create)
└── audio/
    └── extract-audio/ (create)
```

**Tasks:**
- [ ] Create use case for each major operation
- [ ] Define command/query DTOs
- [ ] Implement handlers with explicit dependencies
- [ ] Write integration tests with mock adapters
- [ ] Keep existing pipeline.py working - don't replace yet

**Deliverable**: All major operations available as typed use cases.

---

### Phase 4: Infrastructure Layer (Week 7-8)

**Goal**: Implement adapters for external systems.

#### Repository Adapters

**Python:**
```
backend/streamcraft/infrastructure/persistence/
├── file_system/
│   ├── json_job_repository.py ✅
│   └── json_dataset_repository.py (create)
└── memory/
    └── memory_job_repository.py (for testing)
```

**Tasks:**
- [ ] Migrate `jobs/storage.py` to JsonJobRepository
- [ ] Keep old storage.py as facade initially
- [ ] Add adapter for dataset persistence
- [ ] Write integration tests with real files

#### External API Adapters

**Python:**
```
backend/streamcraft/infrastructure/external_apis/
├── twitch/
│   ├── client.py (create)
│   ├── metadata_fetcher.py (create)
│   └── downloader.py (create)
└── youtube/
    └── ... (future)
```

**Tasks:**
- [ ] Wrap twitchdl in adapter implementing VodMetadataFetcher
- [ ] Extract Twitch logic from pipeline.py
- [ ] Add error handling with Result type
- [ ] Write integration tests (may be slow)

#### Audio Processing Adapters

**Python:**
```
backend/streamcraft/infrastructure/audio_processing/
├── ffmpeg/
│   ├── extractor.py (create)
│   ├── slicer.py (create)
│   └── command_builder.py (create)
├── demucs/
│   └── separator.py (create)
└── soundfile/
    └── analyzer.py (create)
```

**Tasks:**
- [ ] Wrap ffmpeg calls in adapters
- [ ] Extract from dataset.py
- [ ] Add proper error handling
- [ ] Write integration tests

#### Web Layer

**Python:**
```
backend/streamcraft/infrastructure/web/fastapi/
├── app.py (create - new entry point)
├── dependencies.py ✅
├── routes/
│   ├── job_routes.py ✅
│   ├── vod_routes.py (create)
│   ├── audio_routes.py (create)
│   └── dataset_routes.py (create)
└── schemas/
    └── ... (Pydantic models for API)
```

**Tasks:**
- [ ] Create new FastAPI app factory
- [ ] Wire up dependencies
- [ ] Create routes using use case handlers
- [ ] Keep old api/routes.py working temporarily
- [ ] Write API tests

**TypeScript:**
```
frontend/src/infrastructure/
├── http/
│   ├── client/
│   │   ├── http-client.ts ✅
│   │   └── fetch-client.ts ✅
│   └── repositories/
│       ├── http-job.repository.ts ✅
│       ├── http-vod.repository.ts (create)
│       └── http-audio.repository.ts (create)
└── storage/
    └── local-storage/ (create)
```

**Tasks:**
- [ ] Create HTTP repositories
- [ ] Implement repository interfaces
- [ ] Add error handling with Result
- [ ] Wire up to API client

**Deliverable**: All infrastructure adapters implemented and tested.

---

### Phase 5: Presentation Layer (Week 9-10)

**Goal**: Refactor React components to use new architecture.

#### Shared Components

**TypeScript:**
```
frontend/src/presentation/shared/
├── hooks/
│   ├── use-async-result.ts ✅
│   ├── use-job-status.ts (create)
│   └── use-debounce.ts (create)
└── components/
    ├── data-display/
    │   ├── badge/ ✅
    │   ├── card/ (create)
    │   └── list/ (create)
    ├── forms/
    │   ├── input/ (migrate)
    │   └── select/ (migrate)
    └── feedback/
        ├── toast/ (migrate)
        └── spinner/ (migrate)
```

**Tasks:**
- [ ] Create typed shared components
- [ ] Separate props, presenter, and component files
- [ ] Add proper TypeScript types
- [ ] Extract pure logic to presenters

#### Feature Modules

**TypeScript:**
```
frontend/src/presentation/features/
├── vod-management/
│   ├── components/
│   │   ├── vod-metadata-card/ (migrate from components/)
│   │   └── platform-badge/ ✅
│   ├── hooks/
│   │   └── use-vod-metadata.ts (create)
│   └── pages/
│       └── vod-selection.page.tsx (create)
├── audio-processing/
│   ├── components/
│   │   └── audio-extract-section/ (migrate)
│   └── pages/
│       └── audio-processing.page.tsx (create)
├── segment-review/
│   ├── components/
│   │   ├── segment-list/ (migrate)
│   │   └── tinder-review/ (migrate)
│   └── pages/
│       └── segment-review.page.tsx (create)
└── job-management/
    ├── components/
    │   ├── job-list/ (migrate)
    │   └── job-status-card/ (migrate)
    ├── hooks/
    │   └── use-job-polling.ts (create)
    └── pages/
        └── job-management.page.tsx (create)
```

**Tasks:**
- [ ] Migrate one feature at a time
- [ ] Create presenters for business logic
- [ ] Use Result type for API calls
- [ ] Add proper error handling
- [ ] Update tests

**Deliverable**: Modern feature-based React structure with strict typing.

---

### Phase 6: Integration & Cutover (Week 11-12)

**Goal**: Switch to new architecture and remove old code.

#### Backend Integration

**Tasks:**
- [ ] Update `backend/streamcraft/api/main.py` to use new FastAPI app
- [ ] Update CLI commands to use new use case handlers
- [ ] Run full integration tests
- [ ] Compare output with old pipeline
- [ ] Verify performance

#### Frontend Integration

**Tasks:**
- [ ] Update `App.tsx` to use new feature pages
- [ ] Connect to new API endpoints
- [ ] Test all user flows
- [ ] Fix any regressions

#### Cleanup

**Tasks:**
- [ ] Remove old `backend/streamcraft/core/pipeline.py`
- [ ] Remove old `backend/streamcraft/jobs/storage.py`
- [ ] Remove old `backend/streamcraft/api/routes.py`
- [ ] Remove unused dependencies
- [ ] Update documentation
- [ ] Archive old code in git branch

**Deliverable**: Clean codebase running on new architecture.

---

## Validation Checkpoints

### After Each Phase

1. **Type Check**: 
   - Python: `mypy streamcraft --strict`
   - TypeScript: `tsc --noEmit --strict`
   
2. **Unit Tests**: 
   - Python: `pytest tests/unit --cov=streamcraft`
   - TypeScript: `npm test`

3. **Integration Tests**:
   - Python: `pytest tests/integration`
   - E2E: Cypress/Playwright tests

4. **Performance**:
   - Compare execution time with baseline
   - Check memory usage
   - Profile hot paths

---

## Risk Mitigation

### Parallel Development

- Keep old code working until replacement is proven
- Use feature flags if needed
- Deploy new endpoints alongside old ones

### Rollback Plan

1. Git branch strategy:
   ```
   main (stable)
   └── feature/ultra-typed-refactor (migration work)
       ├── feat/domain-layer
       ├── feat/application-layer
       └── feat/infrastructure-layer
   ```

2. Each phase can be rolled back independently
3. Old code removed only after new code is battle-tested

### Testing Strategy

1. **Unit tests**: Domain and application layers
2. **Integration tests**: Infrastructure adapters
3. **E2E tests**: Critical user paths
4. **Snapshot tests**: API responses
5. **Property tests**: Domain invariants

---

## Success Metrics

### Code Quality
- [ ] 100% mypy/TypeScript strict mode compliance
- [ ] 80%+ test coverage
- [ ] Zero `any` types
- [ ] Zero type: ignore comments
- [ ] All functions explicitly typed

### Architecture
- [ ] Domain layer has zero infrastructure imports
- [ ] All errors handled via Result type
- [ ] All IDs are branded types
- [ ] All state transitions explicit
- [ ] All dependencies injected

### Maintainability
- [ ] New developer can understand codebase
- [ ] Easy to add new features
- [ ] Easy to test in isolation
- [ ] Clear separation of concerns
- [ ] Self-documenting code

---

## Daily Workflow

### For Developers During Migration

1. **Morning**:
   ```bash
   git pull origin feature/ultra-typed-refactor
   mypy streamcraft/domain streamcraft/application
   tsc --noEmit
   ```

2. **During Development**:
   - Work in new architecture
   - Keep old code functional
   - Run type checker frequently
   - Write tests immediately

3. **Before Commit**:
   ```bash
   # Python
   mypy streamcraft --strict
   ruff check streamcraft
   pytest tests/unit
   
   # TypeScript  
   tsc --noEmit --strict
   npm run lint
   npm test
   ```

4. **Create PR with**:
   - Type safety proof (mypy/tsc output)
   - Test coverage report
   - Migration checklist items completed

---

## Current Status

**As of**: [Current Date]

### ✅ Completed
- [x] Phase 1: Foundation (Python & TypeScript)
- [x] Core domain examples created
- [x] Example use cases created
- [x] Example adapters created
- [x] Documentation written

### 🚧 In Progress
- [ ] None (awaiting start of Phase 2)

### ⏳ Upcoming
- [ ] Phase 2: Domain Layer - complete all domains
- [ ] Phase 3: Application Layer - all use cases
- [ ] Phase 4: Infrastructure - all adapters
- [ ] Phase 5: Presentation - React components
- [ ] Phase 6: Integration & Cutover

---

## Get Started

### Next Immediate Steps

1. **Review examples**:
   - Python: `backend/streamcraft/domain/job/`
   - TypeScript: `frontend/src/domain/job/`

2. **Run type checkers**:
   ```bash
   cd backend && mypy streamcraft/domain
   cd frontend && tsc src/domain --noEmit
   ```

3. **Continue Phase 3 & 4**:
   - Complete remaining use cases (VOD download, audio slicing, dataset validation, etc.)
   - Implement remaining infrastructure adapters (Twitch API, YouTube API, Demucs wrapper, etc.)
   - Write integration tests for full request flows
   - Create TypeScript application layer equivalents

4. **Questions?**:
   - See [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md)
   - See [TARGET-ARCHITECTURE.md](./TARGET-ARCHITECTURE.md)
   - Check example code

---

## Conclusion

This migration is a significant undertaking but will result in:
- **Type safety**: Catch bugs at compile time
- **Testability**: Easy to unit test pure functions
- **Maintainability**: Clear structure and responsibilities
- **Scalability**: Easy to add features without coupling

Take it one phase at a time. The payoff is worth the effort! 🚀
