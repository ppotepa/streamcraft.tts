# Ultra-Typed Clean Architecture - Refactoring Rules & Examples

## 📋 Quick Reference

This repository demonstrates **ultra-typed clean architecture** with maximum granularity and strict type safety for both Python (backend) and TypeScript (frontend).

### Core Principles

**Both Languages:**
- ✅ Strict type checking (no `any`, no `unknown` without narrowing)
- ✅ Explicit error handling via `Result<T, E>` (no exceptions for expected failures)
- ✅ Branded types for IDs and domain primitives
- ✅ Discriminated unions for variants
- ✅ Immutable data structures
- ✅ Dependency inversion (pure domain, injected IO)
- ✅ High granularity (one responsibility per file)
- ✅ No inheritance (composition over inheritance)

### Python-Specific
- Python 3.12+ with mypy `--strict`
- Frozen dataclasses with slots
- `NewType` for branded types
- `Result = Success[T] | Failure[E]`
- ABC protocols for contracts

### TypeScript-Specific
- TypeScript strict mode (all strict flags enabled)
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- Branded types via unique symbol
- `Result<T, E>` discriminated union
- Abstract classes for contracts

---

## 📁 Architecture Overview

```
Project Structure:
├── domain/          → Pure business logic (no dependencies)
│   ├── shared/      → Branded types, Result, errors, value objects
│   ├── job/         → Job subdomain (entities, value objects, ports)
│   ├── vod/         → VOD subdomain
│   ├── audio/       → Audio subdomain
│   └── dataset/     → Dataset subdomain
│
├── application/     → Use cases (orchestration)
│   ├── shared/      → UseCase base class
│   ├── job/         → Job use cases (create, update, list)
│   ├── vod/         → VOD use cases
│   └── audio/       → Audio use cases
│
├── infrastructure/  → External adapters
│   ├── persistence/ → File system, database adapters
│   ├── external_apis/ → Twitch, YouTube clients
│   ├── audio_processing/ → FFmpeg, Demucs adapters
│   └── web/         → FastAPI routes (Python) / HTTP clients (TypeScript)
│
└── presentation/    → UI layer (TypeScript only)
    ├── shared/      → Reusable components, hooks
    └── features/    → Feature-specific UI modules
```

**Dependency Rule**: `domain ← application ← infrastructure/presentation`

---

## 🚀 Quick Start

### Python Backend

```bash
cd backend

# Install dependencies
pip install -e .
pip install -e ".[dev]"

# Type check
mypy streamcraft --strict

# Lint
ruff check streamcraft

# Run tests
pytest tests/unit --cov=streamcraft
```

### TypeScript Frontend

```bash
cd frontend

# Install dependencies
npm install

# Type check
npm run type-check
# or: tsc --noEmit

# Lint
npm run lint

# Run tests
npm test

# Dev server
npm run dev
```

---

## 📚 Documentation

### Essential Reading

1. **[TARGET-ARCHITECTURE.md](./docs/TARGET-ARCHITECTURE.md)**
   - Complete target directory structure (Python & TypeScript)
   - Architectural principles explained
   - Example implementations
   - Configuration files (mypy, tsconfig, etc.)

2. **[IMPLEMENTATION-GUIDE.md](./docs/IMPLEMENTATION-GUIDE.md)**
   - How to write code in this architecture
   - Result type usage patterns
   - Branded types examples
   - Discriminated unions
   - Migration examples (before/after)
   - Testing strategies

3. **[MIGRATION-ROADMAP.md](./docs/MIGRATION-ROADMAP.md)**
   - 6-phase migration plan  
   - Week-by-week breakdown
   - Tasks, deliverables, checkpoints
   - Risk mitigation strategies
   - Success metrics

---

## 🎯 Example Code Locations

### Python Examples (✅ Created)

**Domain Layer:**
- `backend/streamcraft/domain/shared/branded_types.py` - Type-safe IDs
- `backend/streamcraft/domain/shared/result.py` - Result type
- `backend/streamcraft/domain/shared/errors.py` - Domain errors
- `backend/streamcraft/domain/shared/value_objects.py` - Common value objects
- `backend/streamcraft/domain/job/entities/job.py` - Job aggregate root
- `backend/streamcraft/domain/job/value_objects/job_status.py` - Discriminated union
- `backend/streamcraft/domain/job/ports/job_repository.py` - Repository port
- `backend/streamcraft/domain/vod/value_objects/vod_url.py` - Validated VOD URL

**Application Layer:**
- `backend/streamcraft/application/shared/use_case.py` - UseCase base
- `backend/streamcraft/application/job/create_job/handler.py` - Use case handler
- `backend/streamcraft/application/job/create_job/command.py` - Command
- `backend/streamcraft/application/job/create_job/dto.py` - DTO

**Infrastructure Layer:**
- `backend/streamcraft/infrastructure/persistence/file_system/json_job_repository.py` - Repository adapter
- `backend/streamcraft/infrastructure/web/fastapi/routes/job_routes.py` - FastAPI routes
- `backend/streamcraft/infrastructure/web/fastapi/dependencies.py` - DI container

### TypeScript Examples (✅ Created)

**Domain Layer:**
- `frontend/src/domain/shared/branded-types.ts` - Type-safe IDs
- `frontend/src/domain/shared/result.ts` - Result type
- `frontend/src/domain/shared/errors.ts` - Domain errors
- `frontend/src/domain/shared/value-objects.ts` - Common value objects
- `frontend/src/domain/job/entities/job.entity.ts` - Job entity
- `frontend/src/domain/job/value-objects/job-status.ts` - Discriminated union
- `frontend/src/domain/job/ports/job-repository.ts` - Repository port
- `frontend/src/domain/vod/value-objects/vod-url.ts` - Validated VOD URL

**Application Layer:**
- `frontend/src/application/shared/use-case.ts` - UseCase base (✅)
- `frontend/src/application/job/create-job/` - CreateJob use case (✅)

**Infrastructure Layer:**
- `frontend/src/infrastructure/http/client/` - HTTP client interface & Fetch implementation (✅)
- `frontend/src/infrastructure/http/repositories/http-job.repository.ts` - Repository adapter (✅)

**Presentation Layer:**
- `frontend/src/presentation/shared/hooks/use-async-result.ts` - Result hook (✅)
- `frontend/src/presentation/shared/components/data-display/badge/` - Badge component (✅)
- `frontend/src/presentation/features/vod-management/components/platform-badge/` - Feature component (✅)

---

## 🔍 Key Patterns

### 1. Result Type (No Exceptions for Expected Failures)

**Python:**
```python
from streamcraft.domain.shared.result import Result, Success, Failure

def parse_url(url: str) -> Result[VodUrl, InvalidVodUrlError]:
    try:
        return Success(VodUrl.from_string(url))
    except ValueError as e:
        return Failure(InvalidVodUrlError(url, str(e)))
```

**TypeScript:**
```typescript
import { Result, Ok, Err } from '@domain/shared/result';

function parseUrl(url: string): Result<VodUrl, InvalidVodUrlError> {
  try {
    return Ok(VodUrl.fromString(url));
  } catch (error) {
    return Err(new InvalidVodUrlError(url, String(error)));
  }
}
```

### 2. Branded Types (Prevent ID Mixing)

**Python:**
```python
from streamcraft.domain.shared.branded_types import JobId, VodId, create_job_id

def get_job(job_id: JobId) -> Job: ...

# ✅ OK
get_job(create_job_id("123"))

# ❌ Type error - cannot pass VodId where JobId expected
get_job(vod_id)
```

**TypeScript:**
```typescript
import { JobId, VodId, createJobId } from '@domain/shared/branded-types';

function getJob(jobId: JobId): Job { ... }

// ✅ OK
getJob(createJobId('123'));

// ❌ Type error
getJob(vodId);
```

### 3. Discriminated Unions (Type-Safe Variants)

**Python:**
```python
from streamcraft.domain.job.value_objects.job_status import JobStatus

def handle_status(status: JobStatus) -> str:
    if isinstance(status, IdleStatus):
        return "Idle"
    elif isinstance(status, RunningStatus):
        return f"Running: {status.progress * 100}%"
    elif isinstance(status, DoneStatus):
        return f"Done (exit {status.exit_code})"
    elif isinstance(status, ErrorStatus):
        return f"Error: {status.message}"
    # Mypy ensures all cases covered
```

**TypeScript:**
```typescript
import { JobStatus, matchJobStatus } from '@domain/job/value-objects/job-status';

function handleStatus(status: JobStatus): string {
  return matchJobStatus(status, {
    idle: () => 'Idle',
    running: (s) => `Running: ${s.progress * 100}%`,
    done: (s) => `Done (exit ${s.exitCode})`,
    error: (s) => `Error: ${s.message}`,
  });
  // TypeScript ensures all cases covered
}
```

---

## ✅ What's Been Created

### Configuration Files
- [x] `backend/mypy.ini` - Strict mypy configuration
- [x] `backend/pyproject.toml` - Build config with strict tools
- [x] `frontend/tsconfig.strict.json` - Ultra-strict TypeScript config

### Python Domain Layer
- [x] Shared primitives (branded types, Result, errors, value objects)
- [x] Job domain (entity, value objects, errors, ports)
- [x] VOD domain (entity, value objects, errors, ports)

### Python Application Layer
- [x] UseCase base class
- [x] CreateJob use case (command, handler, dto)

### Python Infrastructure Layer
- [x] JsonJobRepository (file-based persistence)
- [x] FastAPI job routes
- [x] Dependency injection setup

### TypeScript Domain Layer
- [x] Shared primitives (branded types, Result, errors, value objects)
- [x] Job domain (entity, value objects, errors, ports)
- [x] VOD domain (value objects)

### TypeScript Application Layer
- [x] UseCase base class
- [x] CreateJob use case (command, handler, dto)

### TypeScript Infrastructure Layer
- [x] HTTP client abstraction
- [x] Fetch-based implementation
- [x] HttpJobRepository

### TypeScript Presentation Layer
- [x] useAsyncResult hook (Result-based async state)
- [x] Badge component (strict props)
- [x] PlatformBadge feature component

### Documentation
- [x] TARGET-ARCHITECTURE.md (complete architecture spec)
- [x] IMPLEMENTATION-GUIDE.md (how-to guide with examples)
- [x] MIGRATION-ROADMAP.md (6-phase migration plan)
- [x] This README

---

## 🎓 Learning Path

### For New Developers

1. **Read this README** (you are here!)
2. **Review [TARGET-ARCHITECTURE.md](./docs/TARGET-ARCHITECTURE.md)** - Understand the structure
3. **Study example code** - See patterns in action
   - Python: `backend/streamcraft/domain/job/`
   - TypeScript: `frontend/src/domain/job/`
4. **Read [IMPLEMENTATION-GUIDE.md](./docs/IMPLEMENTATION-GUIDE.md)** - Learn how to write code
5. **Try creating something new** - Follow the patterns
6. **Run type checkers frequently** - Let them guide you

### For Migration Work

1. **Read [MIGRATION-ROADMAP.md](./docs/MIGRATION-ROADMAP.md)** - Understand the plan
2. **Verify current phase** - Check what's already done
3. **Pick a task** - From the phase you're working on
4. **Follow examples** - Use existing code as templates
5. **Write tests first** - TDD helps with refactoring
6. **Type check constantly** - `mypy` / `tsc` are your friends

---

## 🛠️ Development Workflow

### Daily Routine

```bash
# 1. Pull latest
git pull origin main

# 2. Python type check
cd backend
mypy streamcraft --strict
ruff check streamcraft

# 3. TypeScript type check
cd ../frontend
tsc --noEmit
npm run lint

# 4. Run affected tests
# Python
pytest tests/unit -v

# TypeScript
npm test

# 5. Make changes...

# 6. Type check again
mypy streamcraft --strict
tsc --noEmit

# 7. Commit
git add .
git commit -m "feat: add <feature> with strict types"
git push
```

### Pre-Commit Checklist

- [ ] All type checkers pass (mypy, tsc)
- [ ] No `any` types introduced
- [ ] No `type: ignore` comments added
- [ ] All functions explicitly typed
- [ ] Result type used for fallible operations
- [ ] Tests written and passing
- [ ] Documentation updated if needed

---

## 📊 Success Criteria

### Type Safety
- [x] mypy strict mode configured
- [x] TypeScript strict mode configured
- [ ] 100% type coverage in new code
- [ ] Zero `any` types
- [ ] Zero `type: ignore` needed

### Architecture
- [x] Domain layer established
- [x] Application layer established
- [x] Infrastructure layer established
- [x] Presentation layer established
- [ ] Domain has zero infrastructure imports
- [ ] All dependencies injected

### Testing
- [x] Example unit tests provided
- [ ] 80%+ test coverage
- [ ] Integration tests for adapters
- [ ] E2E tests for critical paths

### Documentation
- [x] Complete architecture documentation
- [x] Implementation guide
- [x] Migration roadmap
- [x] Code examples

---

## 🤝 Contributing

When contributing to this project:

1. **Follow the architecture** - Domain → Application → Infrastructure/Presentation
2. **Maintain strict typing** - No shortcuts with `any`
3. **Use Result types** - No exceptions for expected failures
4. **Write tests** - Especially for domain logic
5. **Update docs** - If you add new patterns

---

## 📞 Support

- **Architecture questions?** → See [TARGET-ARCHITECTURE.md](./docs/TARGET-ARCHITECTURE.md)
- **Implementation questions?** → See [IMPLEMENTATION-GUIDE.md](./docs/IMPLEMENTATION-GUIDE.md)
- **Migration questions?** → See [MIGRATION-ROADMAP.md](./docs/MIGRATION-ROADMAP.md)
- **Need examples?** → Check `backend/streamcraft/domain/` and `frontend/src/domain/`

---

## 🎉 Summary

You now have:

✅ **Ultra-typed Python backend** with mypy strict mode
✅ **Ultra-typed TypeScript frontend** with strict mode
✅ **Clean architecture** (domain/application/infrastructure/presentation)
✅ **Result type** for explicit error handling
✅ **Branded types** for type-safe IDs
✅ **Discriminated unions** for variants
✅ **Working examples** in both languages
✅ **Complete documentation** for implementation
✅ **Migration roadmap** for refactoring existing code

**Next step**: Start migrating existing code following the [MIGRATION-ROADMAP.md](./docs/MIGRATION-ROADMAP.md)!

---

**Version**: 1.2.0  
**Last Updated**: February 2026  
**Status**: Phase 2 Nearly Complete (~35% Overall) ✅ - Domains Implemented, Ready for More Use Cases
