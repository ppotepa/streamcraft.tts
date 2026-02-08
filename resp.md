# Sanitize Step - Complete Technical Breakdown

## What Is Sanitization?

**Sanitization** is the audio preprocessing step that transforms raw VOD audio into clean, TTS-ready training data by:
- **Removing silence** and dead air
- **Detecting speech segments** where the streamer is talking
- **Normalizing loudness** to consistent levels
- **Extracting voice samples** for TTS reference (optional)

**Input:** Raw audio from Step 2 (full VOD, possibly hours long)  
**Output:** Clean concatenated audio + segment manifest + voice samples

---

## Technical Process Flow

### Phase 1: Audio Loading & Analysis
```
1. Load raw audio WAV file (e.g., vod_2688036561_full.wav)
2. Calculate RMS (Root Mean Square) energy for the entire waveform
3. Build amplitude envelope to detect loud vs quiet regions
```

### Phase 2: Threshold Estimation (Auto Mode)
When **Auto** is enabled, the algorithm automatically determines optimal parameters:

```python
# Backend: estimate_settings()
1. Calculate RMS percentiles across the entire audio
   - 20th percentile = noise floor (background/silence)
   - 80th percentile = speech peak (when streamer talks)
   
2. Derive silence threshold
   silence_threshold_db = noise_floor + (speech_peak - noise_floor) * 0.3
   # Example: -42 dB + (-18 dB - -42 dB) * 0.3 = -35 dB
   
3. Analyze cadence (speech rhythm)
   - Find all regions above threshold
   - Calculate median gap between speech bursts → merge_gap_ms
   - Calculate median segment duration → min_segment_ms
   
4. Set normalization target
   target_peak_db = -1.0  # Just below clipping
```

**Why Auto Mode?** Different streamers have different:
- Mic gain levels (some loud, some quiet)
- Speaking cadence (rapid-fire vs long pauses)
- Background noise (music, game sounds, ambient)

Auto mode adapts to each VOD's characteristics.

### Phase 3: Segment Detection
```python
# Backend: detect_segments()
1. For each audio frame (10ms chunks):
   - Calculate RMS energy
   - Compare to silence_threshold_db
   
2. Mark frames as SPEECH or SILENCE
   Frame RMS > threshold → SPEECH
   Frame RMS ≤ threshold → SILENCE
   
3. Group consecutive SPEECH frames into segments
   
4. Filter short segments
   Discard segments < min_segment_ms (e.g., 800ms)
   # Removes clicks, coughs, single words
   
5. Merge nearby segments
   If gap between segments < merge_gap_ms (e.g., 300ms):
      Combine into one segment
   # Fixes "um... so... yeah" being split into 3 segments
   
6. Calculate segment metadata:
   - start_time (seconds)
   - end_time (seconds)
   - duration (seconds)
   - rms_db (average loudness in dB)
```

**Example Segment:**
```json
{
  "start": 42.5,
  "end": 48.3,
  "duration": 5.8,
  "rms_db": -24.2
}
```

### Phase 4: Clean Audio Generation
```python
# Backend: build_clean_audio()
1. Extract all detected segments from original audio
2. Concatenate them end-to-end (no silence gaps)
3. Apply fade-in/fade-out (fade_ms, e.g., 12ms) to prevent clicks
4. Normalize loudness:
   - Find current peak level
   - Calculate gain to reach target_peak_db (-1 dB)
   - Apply gain uniformly to all samples
   
5. Write clean.wav (e.g., 1800s of pure speech from 7200s VOD)
```

**Before Sanitization:**
```
[silence][speech][silence][music][speech][silence][speech]
 (5min)   (2min)   (10s)   (5min) (3min)   (20s)  (1min)
```

**After Sanitization:**
```
[speech][speech][speech]
 (2min)  (3min)  (1min)  → 6 minutes total, perfectly concatenated
```

### Phase 5: Voice Sample Extraction (Voice Mode Only)

#### Auto-Generate Mode (No References)
```python
1. Filter all segments by criteria:
   - duration >= voiceSampleMinDuration (2s)
   - duration <= voiceSampleMaxDuration (6s)
   - rms_db >= voiceSampleMinRmsDb (-35 dB)
   
2. Sort filtered segments by quality:
   - Primary: duration (longer = better for TTS)
   - Secondary: rms_db (louder = clearer)
   
3. Take top voiceSampleMaxCount (8) segments
   
4. Extract each segment, clip to max 6s, write to voice_samples/
   - voice_sample_00.wav (5.2s, -22 dB)
   - voice_sample_01.wav (5.0s, -23 dB)
   - voice_sample_02.wav (4.8s, -24 dB)
   ...
```

#### Reference-Based Mode (Manual Samples Provided)
```python
1. User selects reference regions (e.g., "10s-15s has perfect voice")
   
2. Analyze reference characteristics:
   ref_duration = 5.0s
   ref_rms_db = -22 dB
   
3. Calculate search bounds (±20% duration, ±3dB):
   target_min_duration = max(slider_min, 5.0 * 0.8) = 4.0s
   target_max_duration = min(slider_max, 5.0 * 1.2) = 6.0s
   target_min_rms = max(slider_min, -22 - 3) = -25 dB
   
4. Find segments matching reference profile:
   candidates = segments where:
     - 4.0s <= duration <= 6.0s
     - rms_db >= -25 dB
     
5. Sort by similarity to reference (duration + loudness)
   
6. Extract top voiceSampleMaxCount similar clips
```

**Why Reference-Based?**
- User hears "this part sounds perfect" → point to it
- Algorithm finds MORE clips that sound similar
- Ensures consistent voice quality across all samples
- Better than random selection from entire VOD

---

## Parameters Explained

### Silence Threshold (-60 to -10 dB)
**What it does:** Defines the energy level below which audio is considered "silence"

```
Lower value (e.g., -50 dB) → More aggressive
  - Removes even faint speech
  - Good for noisy VODs (music, game sounds)
  - Risk: May cut quiet moments
  
Higher value (e.g., -30 dB) → More permissive
  - Keeps more audio
  - Good for clean, quiet streamers
  - Risk: May keep background noise
```

**Example:**
- Streamer normal voice: -25 dB
- Streamer whisper: -40 dB
- Background music: -45 dB
- Silence: -60 dB

Setting threshold to -35 dB → keeps normal + whisper, removes music + silence

### Min Segment (100-3000ms)
**What it does:** Minimum duration a speech segment must be to keep

```
Lower value (e.g., 500ms) → Keep short utterances
  - "oh", "yeah", "nice"
  - More segments = larger dataset
  - Risk: Lots of filler words
  
Higher value (e.g., 1500ms) → Only keep substantial speech
  - Full sentences/phrases only
  - Cleaner dataset
  - Risk: Lose valid short responses
```

**Example:**
```
Audio: "um... [pause] ...so I think [pause] we should push mid"
       (0.5s)          (2.0s)              (1.5s)

min_segment_ms = 800:
  Keeps: "so I think" (2.0s), "we should push mid" (1.5s)
  Discards: "um" (0.5s)
```

### Merge Gap (50-1200ms)
**What it does:** Maximum silence gap to bridge when joining segments

```
Lower value (e.g., 200ms) → Don't bridge pauses
  - Separate sentences stay separate
  - More segments, shorter duration
  
Higher value (e.g., 600ms) → Bridge longer pauses
  - Join related thoughts into one segment
  - Fewer segments, longer duration
  - Preserves natural speech rhythm
```

**Example:**
```
Audio: "I think... [300ms pause] ...we should go"

merge_gap_ms = 200:
  → "I think" (segment 1)
  → "we should go" (segment 2)
  
merge_gap_ms = 400:
  → "I think... we should go" (one segment)
```

### Target Peak (-12 to 0 dB)
**What it does:** Target loudness for the loudest part of audio

```
-1 dB (recommended) → Near maximum
  - Professional audio level
  - No distortion, full dynamic range
  
-6 dB → Conservative
  - Quieter output
  - More headroom
  - Good if further processing planned
```

### Fade (0-50ms)
**What it does:** Crossfade duration at segment boundaries

```
0ms → Hard cuts
  - May hear clicks/pops
  
12ms (recommended) → Smooth transitions
  - Imperceptible fade
  - No artifacts
  
50ms → Very smooth but audible fade-in/out
```

---

## Voice Sample Parameters

### Min/Max Duration
**Controls:** Length of extracted voice samples

```
2-6s (default) → Ideal for TTS training
  - Long enough to capture prosody
  - Short enough to avoid multiple sentences
  - TTS models need 2-10s reference clips
  
Tighter range (3-4s) → Very consistent samples
Wider range (1-10s) → More variety, less consistency
```

### Min Loudness
**Controls:** Reject quiet/background segments

```
-35 dB (default) → Clear speech only
  - Rejects whispers, distant speech
  - Ensures TTS gets strong voice signal
  
-45 dB → More permissive
  - Keeps quieter moments
  - Risk: Weak voice samples
  
-25 dB → Very strict
  - Only excited/loud moments
  - Risk: TTS may sound shouty
```

### Max Samples
**Controls:** How many voice clips to generate

```
8 (default) → Good balance
  - Enough variety for TTS
  - Not too many to review
  
3-5 → Quick iteration
12-15 → Maximum variety
```

---

## Outputs

### 1. Clean Audio (`vod_clean.wav`)
- Concatenated speech segments
- Normalized loudness
- Used by: **Step 4 (Transcription)**

### 2. Segments Manifest (`vod_segments.json`)
```json
[
  {"start": 10.5, "end": 15.3, "duration": 4.8, "rms_db": -24.1},
  {"start": 18.0, "end": 23.5, "duration": 5.5, "rms_db": -22.8},
  ...
]
```
- Metadata for each speech segment
- Used by: **Step 5 (Review)**, **Dataset export**

### 3. Preview Audio (`vod_preview.wav`)
- Downsampled to 24kHz (smaller file)
- Used by: **UI audio player**

### 4. Voice Samples (`voice_samples/*.wav`)
- 5-15 WAV files with ideal voice clips
- Used by: **Step 6 (TTS)** as speaker reference

---

## Complete Workflow Example

**Scenario:** 2-hour gaming VOD

```
1. User clicks "Run sanitize" (Auto mode)
   
2. Backend loads 7200s raw audio
   
3. Auto-tune calculates:
   - silence_threshold_db = -34 dB (streamer is quiet)
   - min_segment_ms = 750ms
   - merge_gap_ms = 280ms
   
4. Segment detection finds 847 speech segments
   - Total speech time: 2850s (47.5 min)
   - Silence removed: 4350s (72.5 min)
   
5. Clean audio generated:
   - 2850s concatenated speech
   - Normalized to -1 dB peak
   - Saved to vod_clean.wav
   
6. User switches to Voice Sample mode:
   - Listens to audio, finds 12.5s-17.5s has perfect voice
   - Sets reference: start=12.5, end=17.5
   - Clicks "Take sample"
   
7. User adjusts sliders:
   - Min duration: 3s
   - Max duration: 7s
   - Min loudness: -32 dB
   - Max samples: 10
   
8. User clicks "Run sanitize" again
   
9. Backend analyzes reference:
   - Reference duration: 5.0s
   - Reference RMS: -23 dB
   
10. Backend searches segments for similar:
    - Duration: 4.0s-6.0s (80-120% of reference)
    - Loudness: ≥ -26 dB (within 3dB of reference)
    
11. Found 94 matching segments
    
12. Sorted by similarity, extracted top 10
    
13. User reviews 10 generated samples:
    - Listens to each
    - Selects 8 best ones (checkboxes)
    
14. Proceeds to TTS step with 8 voice samples
```

---

## Common Issues & Solutions

**Issue:** Too many tiny segments
→ **Increase** min_segment_ms to 1000+

**Issue:** Speech cut mid-word
→ **Lower** silence_threshold_db by 5-10 dB

**Issue:** Background music in segments
→ **Raise** silence_threshold_db to filter out music

**Issue:** Natural pauses removed
→ **Increase** merge_gap_ms to 400-600ms

**Issue:** Voice samples too quiet
→ **Raise** voiceSampleMinRmsDb to -30 dB

**Issue:** Not enough voice samples found
→ **Widen** duration range or **lower** loudness threshold
