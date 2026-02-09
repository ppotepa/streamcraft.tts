# Implementation Guide: Ultra-Typed Clean Architecture

## Overview

This guide shows you how to work with the ultra-typed clean architecture established in this codebase. All examples follow strict typing rules with no `any`, explicit error handling via `Result<T, E>`, and maximum separation of concerns.

---

## Quick Start

### Python Backend

#### 1. Run Type Checking

```bash
# From backend directory
cd backend
mypy streamcraft
ruff check streamcraft
```

#### 2. Create a New Domain Entity

```python
# streamcraft/domain/audio/entities/audio_segment.py
from dataclasses import dataclass
from streamcraft.domain.shared.branded_types import SegmentId
from streamcraft.domain.audio.value_objects.time_range import TimeRange

@dataclass(frozen=True, slots=True)
class AudioSegment:
    """Audio segment entity."""
    
    id: SegmentId
    time_range: TimeRange
    text: str
    
    def duration_seconds(self) -> float:
        """Calculate segment duration."""
        return self.time_range.end - self.time_range.start
```

#### 3. Create a Use Case

```python
# streamcraft/application/audio/slice_audio/handler.py
from streamcraft.application.shared.use_case import UseCase
from streamcraft.domain.audio.ports.audio_slicer import AudioSlicer
from streamcraft.domain.shared.result import Result, Success, Failure

class SliceAudioHandler(UseCase[SliceAudioCommand, SliceAudioDto, Exception]):
    """Handler for slicing audio."""
    
    def __init__(self, audio_slicer: AudioSlicer) -> None:
        self._audio_slicer = audio_slicer
    
    def execute(self, request: SliceAudioCommand) -> Result[SliceAudioDto, Exception]:
        # Use case logic here
        result = self._audio_slicer.slice(request.file_path, request.time_range)
        
        if isinstance(result, Failure):
            return result
        
        segment = result.unwrap()
        return Success(SliceAudioDto(segment_id=str(segment.id)))
```

#### 4. Implement an Adapter

```python
# streamcraft/infrastructure/audio_processing/ffmpeg/slicer.py
from pathlib import Path
from streamcraft.domain.audio.ports.audio_slicer import AudioSlicer
from streamcraft.domain.audio.entities.audio_segment import AudioSegment
from streamcraft.domain.shared.result import Result, ok, err

class FfmpegAudioSlicer(AudioSlicer):
    """FFmpeg-based audio slicer implementation."""
    
    def slice(
        self, 
        file_path: Path, 
        time_range: TimeRange
    ) -> Result[AudioSegment, Exception]:
        try:
            # FFmpeg implementation
            segment = self._execute_ffmpeg(file_path, time_range)
            return ok(segment)
        except Exception as e:
            return err(e)
```

### TypeScript Frontend

#### 1. Run Type Checking

```bash
# From frontend directory
cd frontend
npm run type-check  # or: tsc --noEmit
npm run lint
```

#### 2. Create a Domain Entity

```typescript
// src/domain/audio/entities/audio-segment.entity.ts
import { SegmentId } from '../../shared/branded-types';
import { TimeRange } from '../value-objects/time-range';

export class AudioSegment {
  private constructor(
    readonly id: SegmentId,
    readonly timeRange: TimeRange,
    readonly text: string
  ) {}

  static create(
    id: SegmentId,
    timeRange: TimeRange,
    text: string
  ): AudioSegment {
    return new AudioSegment(id, timeRange, text);
  }

  durationSeconds(): number {
    return this.timeRange.end - this.timeRange.start;
  }
}
```

#### 3. Create a Use Case

```typescript
// src/application/audio/slice-audio/slice-audio.handler.ts
import { UseCase } from '../../shared/use-case';
import { Result, Ok, Err } from '../../../domain/shared/result';
import { AudioSlicer } from '../../../domain/audio/ports/audio-slicer';

export class SliceAudioHandler extends UseCase<
  SliceAudioCommand,
  SliceAudioDto,
  Error
> {
  constructor(private readonly audioSlicer: AudioSlicer) {
    super();
  }

  async execute(
    request: SliceAudioCommand
  ): Promise<Result<SliceAudioDto, Error>> {
    const result = await this.audioSlicer.slice(
      request.filePath,
      request.timeRange
    );

    if (!result.ok) {
      return Err(result.error);
    }

    const segment = result.value;
    return Ok({ segmentId: segment.id });
  }
}
```

#### 4. Create a React Component

```typescript
// src/presentation/features/audio-processing/components/audio-segment-card/audio-segment-card.component.tsx
import React from 'react';
import { AudioSegmentCardProps } from './audio-segment-card.props';
import { AudioSegmentCardPresenter } from './audio-segment-card.presenter';

export const AudioSegmentCard: React.FC<AudioSegmentCardProps> = ({
  segment,
  onPlay,
}) => {
  const presenter = new AudioSegmentCardPresenter(segment);

  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm text-gray-500">
        {presenter.formatDuration()}
      </div>
      <div className="mt-2">{segment.text}</div>
      <button
        onClick={() => onPlay(segment.id)}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Play
      </button>
    </div>
  );
};

// audio-segment-card.presenter.ts (pure logic)
export class AudioSegmentCardPresenter {
  constructor(private readonly segment: AudioSegment) {}

  formatDuration(): string {
    const seconds = this.segment.durationSeconds();
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}
```

---

## Key Patterns

### 1. Result Type Usage

**Never throw exceptions for expected failures. Use Result<T, E>.**

#### Python

```python
from streamcraft.domain.shared.result import Result, Success, Failure

def parse_vod_url(url: str) -> Result[VodUrl, InvalidVodUrlError]:
    """Parse VOD URL with explicit error handling."""
    try:
        vod_url = VodUrl.from_string(url)
        return Success(vod_url)
    except ValueError as e:
        return Failure(InvalidVodUrlError(url, str(e)))

# Usage
result = parse_vod_url(user_input)
if isinstance(result, Success):
    vod_url = result.value
    # Use vod_url
else:
    error = result.error
    # Handle error
```

#### TypeScript

```typescript
import { Result, Ok, Err } from '@domain/shared/result';

function parseVodUrl(url: string): Result<VodUrl, InvalidVodUrlError> {
  try {
    const vodUrl = VodUrl.fromString(url);
    return Ok(vodUrl);
  } catch (error) {
    return Err(new InvalidVodUrlError(url, String(error)));
  }
}

// Usage
const result = parseVodUrl(userInput);
if (result.ok) {
  const vodUrl = result.value;
  // Use vodUrl
} else {
  const error = result.error;
  // Handle error
}
```

### 2. Branded Types

**Use branded types for IDs and domain primitives to prevent mixing.**

#### Python

```python
from streamcraft.domain.shared.branded_types import JobId, VodId

# ❌ WRONG - can accidentally mix IDs
def get_job(id: str) -> Job: ...
get_job(vod_id)  # Oops! Wrong ID type, but compiler doesn't catch it

# ✅ CORRECT - types prevent mixing
def get_job(job_id: JobId) -> Job: ...
get_job(create_job_id("123"))  # OK
get_job(vod_id)  # Type error! Cannot pass VodId where JobId expected
```

#### TypeScript

```typescript
import { JobId, VodId, createJobId } from '@domain/shared/branded-types';

// ❌ WRONG
function getJob(id: string): Job { ... }
getJob(vodId);  // Oops! Wrong type

// ✅ CORRECT
function getJob(jobId: JobId): Job { ... }
getJob(createJobId('123'));  // OK
getJob(vodId);  // Type error!
```

### 3. Discriminated Unions

**Use discriminated unions for variants and states.**

#### Python

```python
from streamcraft.domain.job.value_objects.job_status import (
    JobStatus, IdleStatus, RunningStatus, DoneStatus, ErrorStatus
)

def handle_status(status: JobStatus) -> str:
    """Type-safe exhaustive matching."""
    if isinstance(status, IdleStatus):
        return "Job is idle"
    elif isinstance(status, RunningStatus):
        return f"Job running: {status.progress * 100:.0f}%"
    elif isinstance(status, DoneStatus):
        return f"Job completed with code {status.exit_code}"
    elif isinstance(status, ErrorStatus):
        return f"Job failed: {status.message}"
    # Mypy ensures all cases are covered
```

#### TypeScript

```typescript
import { JobStatus, matchJobStatus } from '@domain/job/value-objects/job-status';

function handleStatus(status: JobStatus): string {
  return matchJobStatus(status, {
    idle: () => 'Job is idle',
    running: (s) => `Job running: ${s.progress * 100}%`,
    done: (s) => `Job completed with code ${s.exitCode}`,
    error: (s) => `Job failed: ${s.message}`,
  });
  // TypeScript ensures all cases are covered
}
```

### 4. Value Objects

**Encapsulate validation in value objects.**

#### Python

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class EmailAddress:
    """Validated email address."""
    
    value: str
    
    def __post_init__(self) -> None:
        if "@" not in self.value:
            raise ValueError(f"Invalid email: {self.value}")
    
    @classmethod
    def create(cls, value: str) -> "EmailAddress":
        return cls(value=value.lower().strip())

# Usage
email = EmailAddress.create("user@example.com")  # Validated
print(email.value)  # Access the validated value
```

#### TypeScript

```typescript
export class EmailAddress {
  private constructor(readonly value: string) {
    this.validate();
  }

  private validate(): void {
    if (!this.value.includes('@')) {
      throw new Error(`Invalid email: ${this.value}`);
    }
  }

  static create(value: string): EmailAddress {
    return new EmailAddress(value.toLowerCase().trim());
  }
}

// Usage
const email = EmailAddress.create('user@example.com');  // Validated
console.log(email.value);  // Access the validated value
```

### 5. Dependency Injection

**Inject dependencies through constructors, not globals.**

#### Python

```python
# ❌ WRONG - global dependency
repository = JsonJobRepository()

class CreateJobHandler:
    def execute(self, cmd: CreateJobCommand) -> Result[Job, Exception]:
        repository.save(job)  # Uses global

# ✅ CORRECT - injected dependency
class CreateJobHandler:
    def __init__(self, repository: JobRepository) -> None:
        self._repository = repository
    
    def execute(self, cmd: CreateJobCommand) -> Result[Job, Exception]:
        self._repository.save(job)  # Uses injected
```

#### TypeScript

```typescript
// ❌ WRONG
const repository = new HttpJobRepository();

class CreateJobHandler {
  execute(cmd: CreateJobCommand) {
    repository.save(job);  // Uses global
  }
}

// ✅ CORRECT
class CreateJobHandler extends UseCase<...> {
  constructor(private readonly repository: JobRepository) {
    super();
  }

  async execute(cmd: CreateJobCommand) {
    await this.repository.save(job);  // Uses injected
  }
}
```

---

## Migration Examples

### Migrating Existing Code

#### Before (Python)

```python
def process_vod(url):
    """Untyped, exception-based."""
    try:
        # Download
        path = download(url)
        
        # Extract audio
        audio = extract_audio(path)
        
        # Transcribe
        text = transcribe(audio)
        
        return {"success": True, "text": text}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

#### After (Python)

```python
from streamcraft.domain.shared.result import Result, Success, Failure
from streamcraft.domain.vod.value_objects.vod_url import VodUrl
from streamcraft.application.vod.process_vod.command import ProcessVodCommand
from streamcraft.application.vod.process_vod.dto import ProcessVodDto

class ProcessVodHandler(UseCase[ProcessVodCommand, ProcessVodDto, Exception]):
    """Fully typed, explicit error handling."""
    
    def __init__(
        self,
        downloader: VodDownloader,
        audio_extractor: AudioExtractor,
        transcriber: Transcriber,
    ) -> None:
        self._downloader = downloader
        self._audio_extractor = audio_extractor
        self._transcriber = transcriber
    
    def execute(self, cmd: ProcessVodCommand) -> Result[ProcessVodDto, Exception]:
        # Validate URL
        try:
            vod_url = VodUrl.from_string(cmd.url)
        except ValueError as e:
            return Failure(e)
        
        # Download
        download_result = self._downloader.download(vod_url)
        if isinstance(download_result, Failure):
            return download_result
        path = download_result.unwrap()
        
        # Extract audio
        audio_result = self._audio_extractor.extract(path)
        if isinstance(audio_result, Failure):
            return audio_result
        audio = audio_result.unwrap()
        
        # Transcribe
        transcript_result = self._transcriber.transcribe(audio)
        if isinstance(transcript_result, Failure):
            return transcript_result
        transcript = transcript_result.unwrap()
        
        return Success(ProcessVodDto(text=transcript.text))
```

#### Before (TypeScript)

```tsx
// Untyped component with any
function JobCard({ job }: any) {
  const [status, setStatus] = useState(job.status);
  
  const handleClick = () => {
    fetch(`/api/jobs/${job.id}`)
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(err => console.error(err));
  };
  
  return <div onClick={handleClick}>{status}</div>;
}
```

#### After (TypeScript)

```tsx
// Fully typed with explicit error handling
import { Job } from '@domain/job/entities/job.entity';
import { JobId } from '@domain/shared/branded-types';
import { useAsyncResult } from '@presentation/shared/hooks/use-async-result';
import { JobCardProps } from './job-card.props';
import { JobCardPresenter } from './job-card.presenter';

export const JobCard: React.FC<JobCardProps> = ({ job, onRefresh }) => {
  const presenter = new JobCardPresenter(job);
  
  const { execute, isLoading, isError, error } = useAsyncResult(
    async () => await fetchJobStatus(job.id)
  );
  
  const handleClick = (): void => {
    execute();
  };
  
  if (isError && error) {
    return <ErrorDisplay error={error} />;
  }
  
  return (
    <div onClick={handleClick}>
      {isLoading ? 'Loading...' : presenter.formatStatus()}
    </div>
  );
};

// job-card.presenter.ts - pure logic separated
export class JobCardPresenter {
  constructor(private readonly job: Job) {}
  
  formatStatus(): string {
    return matchJobStatus(this.job.status, {
      idle: () => 'Ready',
      running: (s) => `Running (${Math.round(s.progress * 100)}%)`,
      done: () => 'Completed',
      error: (s) => `Failed: ${s.message}`,
    });
  }
}
```

---

## Validation Rules

### Must Follow

1. **No `any` or `unknown` without narrowing**
2. **All public functions have explicit types**
3. **Use `Result<T, E>` for fallible operations**
4. **Use branded types for IDs**
5. **Use discriminated unions for variants**
6. **Immutable data structures (readonly/frozen)**
7. **Dependencies injected, not imported**
8. **Domain layer has no infrastructure imports**

### Example Violations

```python
# ❌ WRONG
def process(data):  # No type annotation
    return data.get("value")  # No error handling

# ✅ CORRECT
def process(data: dict[str, Any]) -> Result[str, KeyError]:
    value = data.get("value")
    if value is None:
        return Failure(KeyError("value"))
    return Success(str(value))
```

```typescript
// ❌ WRONG
function process(data: any) {  // any type
  return data.value;  // No validation
}

// ✅ CORRECT
function process(data: unknown): Result<string, Error> {
  if (!isRecord(data) || typeof data['value'] !== 'string') {
    return Err(new Error('Invalid data'));
  }
  return Ok(data['value']);
}
```

---

## Testing

### Python Unit Test Example

```python
from streamcraft.domain.job.entities.job import create_job
from streamcraft.domain.shared.branded_types import create_job_id, create_vod_id
from streamcraft.domain.job.value_objects.step_name import StepName

def test_job_can_start_step() -> None:
    """Test job can start a step."""
    # Arrange
    job = create_job(
        job_id=create_job_id("test-123"),
        vod_id=create_vod_id("vod-456"),
        vod_url="https://twitch.tv/videos/123",
    )
    
    # Act
    result = job.start_step(StepName.EXTRACT_AUDIO)
    
    # Assert
    assert isinstance(result, Success)
    updated_job = result.unwrap()
    assert isinstance(updated_job.status, RunningStatus)
```

### TypeScript Unit Test Example

```typescript
import { Job } from '@domain/job/entities/job.entity';
import { createJobId, createVodId } from '@domain/shared/branded-types';
import { StepName } from '@domain/job/value-objects/step-name';
import { isOk } from '@domain/shared/result';

describe('Job', () => {
  it('can start a step', () => {
    // Arrange
    const job = Job.create(
      createJobId('test-123'),
      createVodId('vod-456'),
      'https://twitch.tv/videos/123'
    );
    
    // Act
    const result = job.startStep(StepName.ExtractAudio);
    
    // Assert
    expect(isOk(result)).toBe(true);
    if (result.ok) {
      expect(result.value.status.kind).toBe('running');
    }
  });
});
```

---

## Further Reading

- [TARGET-ARCHITECTURE.md](./TARGET-ARCHITECTURE.md) - Complete architecture documentation
- Python mypy docs: https://mypy.readthedocs.io/
- TypeScript handbook: https://www.typescriptlang.org/docs/handbook/intro.html
