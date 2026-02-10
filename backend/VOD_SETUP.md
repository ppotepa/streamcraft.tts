# VOD Metadata Fetching Setup

## Overview

The VOD Search feature allows you to fetch metadata from Twitch and YouTube VODs to create TTS dataset jobs.

**Flow:**
1. User enters a VOD URL (Twitch or YouTube)
2. Frontend parses the URL to extract VOD ID and platform
3. Backend calls external API (Twitch Helix or YouTube Data API)
4. Metadata is displayed: Title, Streamer, Duration, Preview
5. User can create a job from the metadata

## Required: Twitch API Credentials

To use Twitch VODs, you **must** get API credentials from Twitch:

### Step 1: Create a Twitch Application

1. Go to https://dev.twitch.tv/console/apps
2. Log in with your Twitch account
3. Click **"Register Your Application"**
4. Fill in the form:
   - **Name**: `StreamCraft TTS` (or any name)
   - **OAuth Redirect URLs**: `http://localhost` (required but not used)
   - **Category**: `Application Integration`
5. Click **"Create"**

### Step 2: Get Your Credentials

1. Click **"Manage"** on your new application
2. Copy the **Client ID**
3. Click **"New Secret"** to generate a **Client Secret**
4. Copy the secret immediately (you can't view it again)

### Step 3: Configure StreamCraft

1. Copy `backend/.env.example` to `backend/.env`
2. Edit `.env` and add your credentials:

```bash
STREAMCRAFT_TWITCH_CLIENT_ID=your_actual_client_id_here
STREAMCRAFT_TWITCH_CLIENT_SECRET=your_actual_client_secret_here
```

3. Restart the backend server

## Optional: YouTube API Credentials

For YouTube support:

1. Go to https://console.cloud.google.com/apis/credentials
2. Create a project or select existing
3. Enable the **YouTube Data API v3**
4. Create an **API Key**
5. Add to `.env`:

```bash
STREAMCRAFT_YOUTUBE_API_KEY=your_youtube_api_key_here
```

## Testing

1. Start the backend: `./run_dev.ps1` or `./watch.ps1`
2. Open the frontend: http://localhost:5173
3. Navigate to **"VOD Search & Job Creation"**
4. Enter a VOD URL:
   - Twitch: `https://www.twitch.tv/videos/2689875280`
   - YouTube: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
5. Click **"Fetch Metadata"**
6. You should see the VOD details appear

## Troubleshooting

### "Failed to fetch VOD metadata"

**Cause**: Missing or invalid API credentials

**Fix**: 
1. Check that `.env` file exists in `backend/` directory
2. Verify credentials are correct (no extra spaces)
3. Restart the backend server after editing `.env`
4. Check backend logs for the actual error

### "Invalid VOD URL"

**Cause**: URL format not recognized

**Supported formats:**
- Twitch: `https://www.twitch.tv/videos/[ID]`
- YouTube: `https://www.youtube.com/watch?v=[ID]`
- YouTube short: `https://youtu.be/[ID]`

### Backend logs show "TWITCH_CLIENT_ID_NOT_SET"

**Cause**: `.env` file not loaded or variables not set

**Fix**:
1. Ensure `.env` file is in `backend/` directory (not `backend/streamcraft/`)
2. Variables must start with `STREAMCRAFT_` prefix
3. No quotes needed around values
4. Restart backend after changes

## Technical Details

**Backend:**
- `TwitchApiClient`: Uses Twitch Helix API v5
- OAuth flow: Client Credentials Grant (app access token)
- Endpoint: `POST https://api.twitch.tv/helix/videos`

**Frontend:**
- `parseVodUrl()`: Extracts ID and platform from URL
- `HttpVodMetadataFetcher`: Makes POST to `/vods/metadata`
- `VodSearchPage`: Main UI component

**Configuration:**
- Settings in `backend/streamcraft/settings.py`
- Uses `pydantic-settings` to load from environment
- Variables loaded from `.env` file automatically
