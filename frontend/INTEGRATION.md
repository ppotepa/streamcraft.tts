# Configuration for Frontend-Backend Integration

## API Communication

The frontend communicates with the backend via HTTP API. Configuration is centralized in [src/config.ts](src/config.ts).

### Base URL Configuration

By default, the frontend expects the backend API at `/api` (same origin). This works when:
- Frontend and backend are served from the same server
- A reverse proxy (like nginx) routes `/api/*` to the backend

For development with separate processes:

1. Create `.env.local` file:
```bash
VITE_API_BASE_URL=http://localhost:8000/api
```

2. The DI container will use this URL for all HTTP requests

### Starting Development Servers

**Backend:**
```bash
cd backend
uvicorn streamcraft.infrastructure.web.fastapi.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm run dev  # Runs on port 5173 by default
```

### Production Deployment

In production, use a reverse proxy to serve both frontend and backend from the same origin:

```nginx
# Nginx example
location /api/ {
    proxy_pass http://backend:8000/api/;
}

location / {
    root /var/www/frontend;
    try_files $uri /index.html;
}
```

## Dependency Injection

The [DependencyContainer](src/di/container.ts) creates all handlers and adapters:

- **HTTP Client**: [FetchClient](src/infrastructure/http/client/fetch-client.ts) with timeout/abort support
- **Repositories**: HTTP-based implementations for Job, VOD, Transcription, Dataset
- **Adapters**: HTTP-based implementations for AudioExtractor, AudioQualityAnalyzer, Transcriber, DatasetWriter
- **Handlers**: All use case handlers wired with appropriate dependencies

## Backend Routes

See [backend routes documentation](../backend/streamcraft/infrastructure/web/fastapi/routes/README.md) for API endpoints.

Key routes:
- `/api/jobs` - Job management
- `/api/vods` - VOD operations
- `/api/audio` - Audio processing
- `/api/transcriptions` - Transcription operations
- `/api/datasets` - Dataset management
