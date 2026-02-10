# streamcraft.tts

automated pipeline for creating tts training datasets from twitch/youtube vods

basically you give it a vod url and it handles everything - downloads video, extracts audio, transcribes with whisper, builds dataset with proper formatting for training tts models

goal is to make the whole process automated so you dont have to manually fiddle with audio files and transcripts

## what you need

**backend:**
- python 3.10+
- ffmpeg (for audio/video processing)
- nvidia gpu with cuda support (required for gpu acceleration)
- pytorch 2.6.0+ with cuda 12.4
- audio-separator 0.41.1 (uvr vocal extraction)
- onnxruntime-gpu (cuda acceleration for uvr)
- faster-whisper (transcription with cuda)

**frontend:**
- node 18+ and npm

## setup

install backend:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e backend
```

note: pytorch with cuda and all gpu dependencies install automatically via requirements.txt

install frontend:
```bash
cd frontend
npm install
```

## running

dev mode (both servers with hot reload):
```bash
.\run_dev.ps1
```

or build production:
```bash
.\build.ps1
```

backend runs at http://localhost:8000  
frontend at http://localhost:5173  
api docs at http://localhost:8000/docs

thats it
