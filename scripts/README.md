# Scripts Directory (Cleaned Up)

All legacy PowerShell scripts have been removed as part of the Clean Architecture migration.

## Current Usage

All functionality is now available via:
- **Backend API**: FastAPI server at `backend/streamcraft/infrastructure/web/fastapi/`
- **Frontend**: React application at `frontend/`
- **Build**: Use `build.ps1` at project root

## Migration Complete

The project now uses Clean Architecture with:
- Python backend with 22 fully wired handlers
- TypeScript/React frontend with 7 complete pages
- Modern dependency injection and type safety
- See [../PROGRESS.md](../PROGRESS.md) and [../README.md](../README.md) for details
