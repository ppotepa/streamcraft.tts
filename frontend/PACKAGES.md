# Frontend Package Setup

## Required Dependencies

The frontend requires React Router Dom which is not yet installed.

### Install Command

```bash
cd frontend
npm install react-router-dom
npm install --save-dev @types/react-router-dom
```

This will install:
- `react-router-dom` (v6) for routing
- Type definitions for TypeScript support

### Why React Router?

The application uses React Router v6 for client-side routing:
- **`/jobs`** - Job dashboard with list of all jobs
- **`/jobs/:jobId`** - Detailed view of specific job
- **`/vods`** - VOD search and metadata fetching
- **`/datasets`** - Dataset builder and management

### Files Using React Router

- [App.tsx](src/App.tsx) - Creates router with `createBrowserRouter`
- [routes/index.tsx](src/routes/index.tsx) - Route definitions
- [layouts/main-layout.component.tsx](src/presentation/layouts/main-layout.component.tsx) - Navigation with `Link` and `Outlet`
- [pages/job-details/job-details.page.tsx](src/presentation/pages/job-details/job-details.page.tsx) - Uses `useParams` and `useNavigate`

### Alternative: Package.json Update

If you prefer, you can add to `package.json`:
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.0",
    "wavesurfer.js": "^7.12.1"
  }
}
```

Then run:
```bash
npm install
```
