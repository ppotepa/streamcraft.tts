# StreamCraft TTS - Setup Guide

## Prerequisites

- Python 3.12+
- Node.js 18+
- npm or yarn

## Backend Setup

1. **Install Python dependencies:**
```bash
cd backend
pip install -e .
```

2. **Run the backend server:**
```bash
cd backend
uvicorn streamcraft.infrastructure.web.fastapi.app:app --reload --port 8000
```

The backend API will be available at `http://localhost:8000`

- API docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

## Frontend Setup

1. **Install dependencies:**
```bash
cd frontend
npm install
```

Note: You'll need to install React Router Dom:
```bash
npm install react-router-dom
npm install --save-dev @types/react-router-dom
```

2. **Configure API base URL (optional):**

Create `frontend/.env.local`:
```
VITE_API_BASE_URL=http://localhost:8000/api
```

Or use the default `/api` which works with Vite's proxy configuration.

3. **Run the frontend dev server:**
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Architecture

### Backend

- **Clean Architecture** with Domain → Application → Infrastructure → Web layers
- **FastAPI** with automatic OpenAPI documentation
- **Dependency Injection** via `dependencies.py`
- **Result Pattern** for error handling
- **Memory Repositories** for transcription and dataset storage (for now)

### Frontend

- **React 18** with TypeScript strict mode
- **React Router v6** for navigation
- **Tailwind CSS** for styling
- **Clean Architecture** with Domain → Application → Infrastructure → Presentation layers
- **Dependency Injection** via DI container and React Context
- **HTTP Adapters** for all domain ports

## Available Routes

### Backend API

- `POST /api/jobs` - Create job
- `GET /api/jobs` - List jobs
- `GET /api/jobs/{id}` - Get job status
- `POST /api/jobs/{id}/steps/start` - Start job step
- `POST /api/jobs/{id}/steps/complete` - Complete job step
- `POST /api/jobs/{id}/steps/fail` - Fail job step
- `POST /api/jobs/{id}/cancel` - Cancel job
- `POST /api/jobs/{id}/retry` - Retry failed job

- `POST /api/vods/metadata` - Fetch VOD metadata
- `POST /api/vods/download` - Download VOD

- `POST /api/audio/extract` - Extract audio from video
- `POST /api/audio/analyze` - Analyze audio quality
- `POST /api/audio/slice` - Slice audio into segments
- `POST /api/audio/merge` - Merge audio segments

- `POST /api/transcriptions/transcribe` - Transcribe audio
- `GET /api/transcriptions/{id}` - Get transcript
- `POST /api/transcriptions/parse` - Parse subtitle file
- `POST /api/transcriptions/{id}/filter` - Filter transcript cues

- `POST /api/datasets` - Create dataset
- `POST /api/datasets/{id}/validate` - Validate dataset
- `POST /api/datasets/{id}/export` - Export dataset
- `POST /api/datasets/{id}/split` - Split dataset

### Frontend Pages

- `/` or `/jobs` - Job Dashboard (list all jobs)
- `/jobs/:jobId` - Job Details (detailed view)
- `/vods` - VOD Search (fetch metadata, create jobs)
- `/datasets` - Dataset Builder (create and manage datasets)

## Development Workflow

1. Start backend: `uvicorn streamcraft.infrastructure.web.fastapi.app:app --reload --port 8000`
2. Start frontend: `npm run dev` (in frontend directory)
3. Navigate to `http://localhost:5173`
4. Frontend proxies `/api` requests to backend via Vite config

## Testing

### Backend

The backend uses memory repositories for transcription and dataset storage. These can be replaced with persistent storage implementations (e.g., JSON files, databases) later.

### Frontend

The frontend's DI container is configured to use HTTP adapters that communicate with the backend API. All port implementations are HTTP-based.

## Next Steps

- [ ] Implement actual Whisper transcription (currently placeholder)
- [ ] Implement VOD downloaders (Twitch/YouTube)
- [ ] Add persistent storage for transcriptions and datasets
- [ ] Add authentication/authorization
- [ ] Add WebSocket support for real-time job progress
- [ ] Add unit tests and integration tests
- [ ] Add E2E tests with Playwright
