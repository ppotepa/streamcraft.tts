
# TTS Wizard App — Full UX/UI Spec (Web UI + Python Backend)
**Version:** v1.0 (Master)  
**Audience:** Dev (frontend + python backend), UX/UI, future contributors  
**Product type:** Power-user internal tool (initially single user)  
**Core flow:** VOD → Audio → Sanitize → SRT → TTS  
**Advanced:** Segment Review + Export + Voice Lab iteration (speaker-focused isolation)  
**Key UX goals:** predictability, low cognitive load, transparent state, fast iteration, strong handoff

---

## Repo mapping (current project)
- The React entrypoint is [ui/react/src/main.tsx](../ui/react/src/main.tsx); there is currently no `App.tsx` or component source in the repo (only a compiled bundle under `ui/react/dist`).
- Recreate the UI under `ui/react/src`:
  - `ui/react/src/app/App.tsx` — main wizard shell
  - `ui/react/src/components/*` — shared UI pieces (StatusCard, PathRow, PresetBar, DiffBanner, AudioPreviewCard, WaveformBars, Toast, EmptyState, etc.)
  - `ui/react/src/hooks/*` — view-model hooks for API + state
  - `ui/react/src/state/*` — step state machines and models
  - Keep existing styling entry [ui/react/src/styles.css](../ui/react/src/styles.css) (Pico + Tailwind v4 import, Space Grotesk/JetBrains Mono fonts).
- Generated assets live in `ui/react/dist` and should be ignored for source edits.
- Build/run commands: `cd ui/react && npm install && npm run dev|build`.
- The spec below stays authoritative for UX; use this mapping to align new source files with the current repo layout.

---

## 0) Scope & Non-goals

### In scope
- Wizard layout and unlocking logic (5 steps)
- Global console (logs), status reporting, progress
- Sanitize settings + preview audio + waveform
- Segment Review Overlay (manual keep/drop + autosave)
- Export accepted clips + freshness detection
- Voice Lab (iterative run using accepted samples, A/B compare, apply)
- Presets system:
  - Sanitize presets
  - Voice Lab presets
  - Streamer profile defaults + datasetPath context
- Accessibility essentials + keyboard-driven review
- Error states & edge-case handling
- Developer handoff requirements (data model expectations, UI-to-API mapping, artifacts)

### Non-goals (v1)
- Multi-user auth/roles
- Deep waveform editing / DAW features
- Full analytics dashboard (only minimal metrics hooks)
- Mobile-first optimization (responsive “acceptable”, desktop-first)

---

## 1) Product assumptions & personas

### Persona: “Power User / Operator”
- Technical, expects precise feedback (exit codes, paths, logs)
- Wants speed: keyboard shortcuts, copy buttons, predictable layout
- Accepts complexity if it’s structured (clear sections, consistent patterns)
- Needs iteration loop to improve voice isolation & training samples

### Success criteria (UX)
- User can complete pipeline with minimal confusion
- Errors are actionable (clear, traceable via logs)
- Iteration loop is fast and measurable (A/B compare + presets)
- Presets reduce repeated parameter tuning

---

## 2) Information Architecture (IA)

### Primary navigation
- Wizard steps (5): sequential, locked by `ready` chain

### Secondary modes
- **Sanitize Drawer**: quick access to applied settings, diffs, rerun
- **Segment Review Overlay**: fullscreen manual labeling
- **Voice Lab**: iterative “isolate streamer voice” mode from accepted samples
- **Preset Management**: modal for CRUD + import/export

---

## 3) Global layout & structure

### Desktop layout (>=1200px)
3 regions (12-col grid):
- **Sidebar** (Steps): 3 cols (min 280px, max 320px)
- **Main content** (Active step): 6 cols (min 640px)
- **Console** (Logs): 3 cols (min 320px, max 420px)

### Tablet (768–1199px)
- Sidebar stays (narrower)
- Console becomes **bottom collapsible panel** (sticky)

### Mobile (<768px)
- Steps as **top horizontal stepper** + steps list in sheet
- Console as **bottom sheet**
- Review remains fullscreen overlay (usable but not optimized)

---

## 4) Global navigation & unlocking rules

### Wizard chain (hard rule)
`vodReady → audioReady → sanitizeReady → srtReady → ttsReady`

### Click behavior
- Sidebar click allowed only if step is unlocked:
  - step N is active if N is clicked AND either N == 1 or step N-1 `ready=true`
- Mini-stepper (in Main) respects same rule
- Next/Previous:
  - Next disabled when next is locked
  - Next disabled on final step

### UI affordances for locks
- Locked step row: opacity 0.5 + cursor-not-allowed + lock icon
- Tooltip: “Complete previous step to unlock.”

---

## 5) Global UI patterns (consistent across steps)

### 5.1 Step Header (Main)
Always present:
- Title: “3. Sanitize”
- Subtitle: one-line purpose summary
- Status chip: Idle / Running / Done / Error (+ Ready badge)
- Optional: elapsed time

### 5.2 Mini stepper / progress header
- Shows all 5 steps with status icons
- Clickable only if unlocked
- Mirrors sidebar status visually

### 5.3 Sticky footer navigation
- `Previous` (secondary)
- `Next` (primary)
- Helper line:
  - If locked: “Unlock condition: Complete previous step”
  - If running: “Step is running… check Console for details”
  - If error: “Resolve error to proceed”

---

## 6) Console (global logs)

### Purpose
Single source of truth for backend execution details.

### UI
- Header: “Console”
  - Actions: `Clear`, `Collapse/Expand`, optional `Follow`
- Body: monospace `<pre>` rendering `string[]` log buffer
- Behavior:
  - Append logs live during running
  - Autoscroll when `Follow=true`
  - `Clear` confirms only if a step is currently running

### Integration
Every `StatusCard` includes:
- “View logs” link that scrolls/focuses console
- If running: label “Live logs…”

---

## 7) Core components (design system)

### 7.1 Tokens (recommended minimum)
- Spacing: 4 / 8 / 12 / 16 / 24 / 32
- Radius:
  - Cards: 12
  - Inputs: 10
  - Chips: 999
- Typography:
  - Step title: 22–24 semibold
  - Section title: 16 semibold
  - Body: 14–16
  - Mono (console/excerpts): 12–13
- Elevation:
  - Card: 1
  - Modal/Drawer: 2

### 7.2 Reusable components
- **StatusCard**
  - Progress bar (60% when running; 100% when done/error)
  - Status text + message
  - Ready badge
  - Exit code badge
  - Elapsed time
  - Output paths (via PathRow)
  - “View logs”
- **PathRow**
  - Label + path text
  - Actions: `Copy` + `Open`
- **PresetBar**
  - Dropdown + Save + Save as… + Manage
- **SettingsRow**
  - Slider + number input + unit label
  - Tooltip
  - Reset-to-default icon
- **DiffBanner**
  - Warning + short explanation + CTA “Re-run”
- **AudioPreviewCard**
  - Play/Stop
  - Loading/Error states
  - Duration + sampleRate
  - WaveformBars
- **WaveformBars**
  - ~240 downsampled bars
  - Optional playhead
- **Toast**
  - “Copied”, “Export done”, “Saved”
- **EmptyState**
  - “No preview yet. Run sanitize to generate preview audio.”

---

## 8) Data model expectations (UI contract)

### 8.1 Step state (per step)
```ts
type StepStatus = "idle" | "running" | "done" | "error";

type StepState = {
  id: "vod" | "audio" | "sanitize" | "srt" | "tts";
  status: StepStatus;
  ready: boolean;
  message?: string;
  exitCode?: number;
  startedAt?: string; // ISO
  endedAt?: string;   // ISO
  paths?: Record<string, string>;        // filesystem paths
  artifactUrls?: Record<string, string>; // URLs for UI open/preview
};

type FlowState = {
  steps: StepState[];
  logs: string[];
  vodMeta?: {
    streamer?: string;
    title?: string;
    durationSec?: number;
    previewUrl?: string;
    thumbUrl?: string;
  };

  // sanitize run output
  sanitizeRun?: {
    previewPath?: string;
    previewArtifactUrl?: string;
    previewDurationSec?: number;
    previewSampleRate?: number;
    segmentsPath?: string;
    segmentsArtifactUrl?: string;
    segmentsCount?: number;
    cleanPath?: string;
    cleanArtifactUrl?: string;
    cleanDurationSec?: number;
    appliedSettings?: SanitizeSettings;
    diffNotes?: string[];
    instructionPlan?: string[];
    waveformSamples?: number[]; // optional cached or computed
  };

  // review
  review?: {
    votes: Record<number, "keep" | "drop">;
    reviewIndex: number;
    savedAt?: string;
    saving?: boolean;
    saveError?: string;
    reviewSignature?: string;
    exportSignature?: string;
    export?: {
      clipsDir?: string;
      clipsCount?: number;
      sampleRate?: number;
      items?: { path: string; url: string }[];
      exportNeedsRefresh?: boolean;
      exportCopied?: boolean;
    };
  };

  // presets
  presets?: {
    sanitize: Preset[];
    voiceLab: Preset[];
    streamerProfiles: StreamerProfile[];
  };

  // voice lab
  voiceLab?: {
    status: StepStatus;
    message?: string;
    exitCode?: number;
    output?: {
      isolatedPath?: string;
      isolatedUrl?: string;
      reportPath?: string;
      reportUrl?: string;
    };
    compare?: {
      aUrl?: string; // current sanitize preview
      bUrl?: string; // isolated output
    };
  };
};

type SanitizeSettings = {
  silenceThresholdDb: number;
  minSegmentMs: number;
  mergeGapMs: number;
  targetPeakDb: number;
  fadeMs: number;
};

type VoiceLabSettings = {
  method: "isolate_streamer_voice";
  strength: number; // 0..1 or 0..100
  noiseGate?: number;
  enhanceSpeech?: boolean;
  useDemucsVocals?: boolean;
};
````md
# TTS Wizard App — Full UX/UI Spec (Web UI + Python Backend)
**Version:** v1.0 (Master)  
**Audience:** Dev (frontend + python backend), UX/UI, future contributors  
**Product type:** Power-user internal tool (initially single user)  
**Core flow:** VOD → Audio → Sanitize → SRT → TTS  
**Advanced:** Segment Review + Export + Voice Lab iteration (speaker-focused isolation)  
**Key UX goals:** predictability, low cognitive load, transparent state, fast iteration, strong handoff

---

## 0) Scope & Non-goals

### In scope
- Wizard layout and unlocking logic (5 steps)
- Global console (logs), status reporting, progress
- Sanitize settings + preview audio + waveform
- Segment Review Overlay (manual keep/drop + autosave)
- Export accepted clips + freshness detection
- Voice Lab (iterative run using accepted samples, A/B compare, apply)
- Presets system:
  - Sanitize presets
  - Voice Lab presets
  - Streamer profile defaults + datasetPath context
- Accessibility essentials + keyboard-driven review
- Error states & edge-case handling
- Developer handoff requirements (data model expectations, UI-to-API mapping, artifacts)

### Non-goals (v1)
- Multi-user auth/roles
- Deep waveform editing / DAW features
- Full analytics dashboard (only minimal metrics hooks)
- Mobile-first optimization (responsive “acceptable”, desktop-first)

---

## 1) Product assumptions & personas

### Persona: “Power User / Operator”
- Technical, expects precise feedback (exit codes, paths, logs)
- Wants speed: keyboard shortcuts, copy buttons, predictable layout
- Accepts complexity if it’s structured (clear sections, consistent patterns)
- Needs iteration loop to improve voice isolation & training samples

### Success criteria (UX)
- User can complete pipeline with minimal confusion
- Errors are actionable (clear, traceable via logs)
- Iteration loop is fast and measurable (A/B compare + presets)
- Presets reduce repeated parameter tuning

---

## 2) Information Architecture (IA)

### Primary navigation
- Wizard steps (5): sequential, locked by `ready` chain

### Secondary modes
- **Sanitize Drawer**: quick access to applied settings, diffs, rerun
- **Segment Review Overlay**: fullscreen manual labeling
- **Voice Lab**: iterative “isolate streamer voice” mode from accepted samples
- **Preset Management**: modal for CRUD + import/export

---

## 3) Global layout & structure

### Desktop layout (>=1200px)
3 regions (12-col grid):
- **Sidebar** (Steps): 3 cols (min 280px, max 320px)
- **Main content** (Active step): 6 cols (min 640px)
- **Console** (Logs): 3 cols (min 320px, max 420px)

### Tablet (768–1199px)
- Sidebar stays (narrower)
- Console becomes **bottom collapsible panel** (sticky)

### Mobile (<768px)
- Steps as **top horizontal stepper** + steps list in sheet
- Console as **bottom sheet**
- Review remains fullscreen overlay (usable but not optimized)

---

## 4) Global navigation & unlocking rules

### Wizard chain (hard rule)
`vodReady → audioReady → sanitizeReady → srtReady → ttsReady`

### Click behavior
- Sidebar click allowed only if step is unlocked:
  - step N is active if N is clicked AND either N == 1 or step N-1 `ready=true`
- Mini-stepper (in Main) respects same rule
- Next/Previous:
  - Next disabled when next is locked
  - Next disabled on final step

### UI affordances for locks
- Locked step row: opacity 0.5 + cursor-not-allowed + lock icon
- Tooltip: “Complete previous step to unlock.”

---

## 5) Global UI patterns (consistent across steps)

### 5.1 Step Header (Main)
Always present:
- Title: “3. Sanitize”
- Subtitle: one-line purpose summary
- Status chip: Idle / Running / Done / Error (+ Ready badge)
- Optional: elapsed time

### 5.2 Mini stepper / progress header
- Shows all 5 steps with status icons
- Clickable only if unlocked
- Mirrors sidebar status visually

### 5.3 Sticky footer navigation
- `Previous` (secondary)
- `Next` (primary)
- Helper line:
  - If locked: “Unlock condition: Complete previous step”
  - If running: “Step is running… check Console for details”
  - If error: “Resolve error to proceed”

---

## 6) Console (global logs)

### Purpose
Single source of truth for backend execution details.

### UI
- Header: “Console”
  - Actions: `Clear`, `Collapse/Expand`, optional `Follow`
- Body: monospace `<pre>` rendering `string[]` log buffer
- Behavior:
  - Append logs live during running
  - Autoscroll when `Follow=true`
  - `Clear` confirms only if a step is currently running

### Integration
Every `StatusCard` includes:
- “View logs” link that scrolls/focuses console
- If running: label “Live logs…”

---

## 7) Core components (design system)

### 7.1 Tokens (recommended minimum)
- Spacing: 4 / 8 / 12 / 16 / 24 / 32
- Radius:
  - Cards: 12
  - Inputs: 10
  - Chips: 999
- Typography:
  - Step title: 22–24 semibold
  - Section title: 16 semibold
  - Body: 14–16
  - Mono (console/excerpts): 12–13
- Elevation:
  - Card: 1
  - Modal/Drawer: 2

### 7.2 Reusable components
- **StatusCard**
  - Progress bar (60% when running; 100% when done/error)
  - Status text + message
  - Ready badge
  - Exit code badge
  - Elapsed time
  - Output paths (via PathRow)
  - “View logs”
- **PathRow**
  - Label + path text
  - Actions: `Copy` + `Open`
- **PresetBar**
  - Dropdown + Save + Save as… + Manage
- **SettingsRow**
  - Slider + number input + unit label
  - Tooltip
  - Reset-to-default icon
- **DiffBanner**
  - Warning + short explanation + CTA “Re-run”
- **AudioPreviewCard**
  - Play/Stop
  - Loading/Error states
  - Duration + sampleRate
  - WaveformBars
- **WaveformBars**
  - ~240 downsampled bars
  - Optional playhead
- **Toast**
  - “Copied”, “Export done”, “Saved”
- **EmptyState**
  - “No preview yet. Run sanitize to generate preview audio.”

---

## 8) Data model expectations (UI contract)

### 8.1 Step state (per step)
```ts
type StepStatus = "idle" | "running" | "done" | "error";

type StepState = {
  id: "vod" | "audio" | "sanitize" | "srt" | "tts";
  status: StepStatus;
  ready: boolean;
  message?: string;
  exitCode?: number;
  startedAt?: string; // ISO
  endedAt?: string;   // ISO
  paths?: Record<string, string>;        // filesystem paths
  artifactUrls?: Record<string, string>; // URLs for UI open/preview
};
````

### 8.2 Global flow

```ts
type FlowState = {
  steps: StepState[];
  logs: string[];
  vodMeta?: {
    streamer?: string;
    title?: string;
    durationSec?: number;
    previewUrl?: string;
    thumbUrl?: string;
  };

  // sanitize run output
  sanitizeRun?: {
    previewPath?: string;
    previewArtifactUrl?: string;
    previewDurationSec?: number;
    previewSampleRate?: number;
    segmentsPath?: string;
    segmentsArtifactUrl?: string;
    segmentsCount?: number;
    cleanPath?: string;
    cleanArtifactUrl?: string;
    cleanDurationSec?: number;
    appliedSettings?: SanitizeSettings;
    diffNotes?: string[];
    instructionPlan?: string[];
    waveformSamples?: number[]; // optional cached or computed
  };

  // review
  review?: {
    votes: Record<number, "keep" | "drop">;
    reviewIndex: number;
    savedAt?: string;
    saving?: boolean;
    saveError?: string;
    reviewSignature?: string;
    exportSignature?: string;
    export?: {
      clipsDir?: string;
      clipsCount?: number;
      sampleRate?: number;
      items?: { path: string; url: string }[];
      exportNeedsRefresh?: boolean;
      exportCopied?: boolean;
    };
  };

  // presets
  presets?: {
    sanitize: Preset[];
    voiceLab: Preset[];
    streamerProfiles: StreamerProfile[];
  };

  // voice lab
  voiceLab?: {
    status: StepStatus;
    message?: string;
    exitCode?: number;
    output?: {
      isolatedPath?: string;
      isolatedUrl?: string;
      reportPath?: string;
      reportUrl?: string;
    };
    compare?: {
      aUrl?: string; // current sanitize preview
      bUrl?: string; // isolated output
    };
  };
};
```

### 8.3 Settings schemas

```ts
type SanitizeSettings = {
  silenceThresholdDb: number;
  minSegmentMs: number;
  mergeGapMs: number;
  targetPeakDb: number;
  fadeMs: number;
};

type VoiceLabSettings = {
  method: "isolate_streamer_voice";
  strength: number; // 0..1 or 0..100
  noiseGate?: number;
  enhanceSpeech?: boolean;
  useDemucsVocals?: boolean;
};
```

---

## 9) Step specs (layout + actions + states)

---

# Step 1 — VOD

## Layout (Main)

Two-column (desktop):

* Left: inputs
* Right: results/meta

### Inputs (Left)

* VOD URL input (full width)

  * Button: `Paste`
* Checkboxes:

  * Force
  * Demucs (source separation)
  * Skip AAC (skip AAC transcoding)
* Primary CTA: `Check VOD`

### Results (Right)

* StatusCard (vod state)
* VodMetaCard:

  * Thumb 320×180 (fallback placeholder)
  * Streamer
  * Title
  * Duration
  * Button: `Open preview` (if previewUrl)

## Actions

* `runVodCheck` → `api.checkVod(vodUrl)`

  * Updates: `flow.vod.status/ready/message/exitCode`
  * Sets `VodMeta` and thumb/preview

## Unlock

* Audio unlocked when `flow.vod.ready=true`

## Edge cases + microcopy

* Empty URL: “Paste a VOD URL to continue.”
* Invalid URL: “This doesn’t look like a valid VOD URL.”
* Failed metadata: “Couldn’t fetch VOD metadata. View logs.”
* No thumbnail: placeholder “No thumbnail available.”

---

# Step 2 — Audio

## Layout (Main)

Single-column “boring and fast”

* StatusCard (audio state)
* PathRow output for extracted audio
* CTA row:

  * Primary: `Extract audio`
  * Secondary (optional): `Back to VOD options`

## Actions

* `runAudio` → `api.runAudio({vodUrl, force, useDemucs, skipAac})`

  * Updates: `flow.audio.status/ready/message/exitCode`
  * Outputs: `paths.audio` + artifact URL

## Unlock

* Sanitize unlocked when `flow.audio.ready=true`

## Edge cases + microcopy

* Demucs missing/fail: “Demucs failed. Try without separation or check logs.”
* Permission denied: “Output path not writable. Check backend permissions.”
* Running: “Extracting audio… check Console for progress.”

---

# Step 3 — Sanitize (core)

## Layout (Main)

Two-column (desktop):

* Left: Settings + Presets + Plan
* Right: Results + Preview + Actions

---

## 3.1 Presets (top of left column)

**PresetBar**:

* Dropdown: `[ Default ▼ ]`
* Buttons:

  * `Save` (overwrite current preset, only user presets)
  * `Save as…`
  * `Manage`

### Preset dropdown groups

* Factory presets (readonly)
* User presets
* Per-streamer presets (when streamer context available)

---

## 3.2 Settings (left column)

SettingsGroup with `SettingsRow` for:

* silenceThresholdDb (dB)
* minSegmentMs (ms)
* mergeGapMs (ms)
* targetPeakDb (dB)
* fadeMs (ms)

Each SettingsRow:

* Slider + number input + unit
* Tooltip: 1–2 lines “what it affects”
* Reset icon

---

## 3.3 Instruction stack (left column)

List “pipeline plan” (readable, ordered):

* Trim silence
* Enforce minimum segment length
* Merge small gaps
* Normalize to target peak
* Fade in/out

---

## 3.4 Diff Banner (left column)

Shown when `sanitizeSettingsDirty`:

* “Settings changed since last run. Re-run to apply.”
* CTA: `Re-run sanitize`

### Dirty determination

* Compare current settings vs `sanitizeRun.appliedSettings`
* Produce `diffNotes`

---

## 3.5 Results (right column)

* StatusCard (sanitize state)

  * cleanPath + segmentsPath
  * segment count + clean duration label
  * exitCode badge + ready badge
  * “View logs”
* AudioPreviewCard

  * Play / Stop
  * loading/error/duration/sampleRate
  * WaveformBars

---

## 3.6 Actions (right column)

* Secondary: `Open Sanitize Drawer`
* Primary: `Review segments`

---

## 3.7 Sanitize Drawer (side panel)

Purpose: “control room” without leaving step.
Contents:

* Applied settings (readonly)
* Diff notes
* Instruction plan
* Audio preview (same as main)
* CTA: `Re-run sanitize` (busy state)
* Close

---

## 3.8 Audio preview behavior (Sanitize)

### Loading

`loadPreviewAudio(artifactUrl)`

* fetch → decodeAudioData → set:

  * previewState: {loading/error/objectUrl/sampleRate/duration}
  * waveformSamples (downsampled)

### Playback controls

* `playPreview()` (full)
* `stopPreview()`
* `playSegmentSnippet(offsetSec, durationSec)`

### Safety rules

* Resume AudioContext before play
* Stop BufferSource on stop/jump
* Revoke object URL on reset/unmount

---

## Actions

* `runSanitize` → `api.runSanitize(payload)`

  * payload includes settings + input audio + additional flags if needed
  * updates: `flow.sanitize.status/ready/message/exitCode`
  * outputs: `paths.clean`, `paths.segments`, sanitizeRun summary

## Unlock

* SRT unlocked when `flow.sanitize.ready=true`

## Edge cases + microcopy

* No preview: “No preview yet. Run sanitize to generate preview audio.”
* Decode fail: “Preview failed to load. Check artifact URL or logs.”
* 0 segments: “No segments produced. Try lowering threshold or min length.”
* Running: “Sanitizing audio… check Console for details.”

---

# Step 4 — SRT

## Layout (Main)

* StatusCard (srt state)
* SrtExcerptCard (scrollable)
* CTA row:

  * Primary: `Generate SRT`
  * Secondary: `Open SRT file` (enabled when ready)

## Outputs shown

* paths.srt + artifactUrl
* srtLines count
* excerpt (render with monospace option)

## Actions

* `runSrt` → `api.runSrt({vodUrl})`

  * updates: `flow.srt.status/ready/message/exitCode`
  * outputs: `paths.srt`, `srtLines`, `srtExcerpt`

## Unlock

* TTS unlocked when `flow.srt.ready=true`

## Edge cases + microcopy

* Running: “Generating transcript… check Console.”
* Error: “SRT generation failed (exit X). View logs.”
* Excerpt empty: “No excerpt available.”

---

# Step 5 — TTS

## Layout (Main)

* Textarea (min 160–220px)

  * default sample text
  * optional char count
* StatusCard (tts state)
* Info chips:

  * model: `xtts_v2`
  * datasetPath: `dataset/<streamer>`
* CTA:

  * Primary: `Generate TTS`
  * Secondary: `Open output` / `Copy path` (when ready)

## Actions

* `runTts` → `api.runTts({vodUrl, text, streamer})`

  * updates: `flow.tts.status/ready/message/exitCode`
  * outputs: `paths.tts`

## Edge cases + microcopy

* Empty text: “Enter text to generate speech.”
* Running: “Generating TTS… check Console.”
* Error: “TTS failed (exit X). View logs.”

---

## 10) Segment Review Overlay (manual keep/drop)

### Purpose

Manual selection of segments for:

* improving training samples
* driving Voice Lab iteration
* controlling export of clips

### Entry points

* Step 3 primary button: `Review segments` (enabled when sanitize preview ready)

---

## 10.1 Overlay structure (fullscreen modal)

### Top bar (sticky)

* Title: “Segment Review”
* Hotkeys hint: `Enter keep • Space drop • ← undo • Esc close`
* Preview status: Ready/Loading/Error
* Sync status:

  * “Saving…”
  * “Saved at 12:34”
  * “Error saving (Retry)”
* Export status:

  * “Up to date”
  * “Needs refresh” (reviewSignature != exportSignature)
* Buttons:

  * `Export accepted clips`
  * `Iterate (Voice Lab)`
  * `Close`

---

## 10.2 Main content (2 columns)

### Left column: progress + tile grid

* Progress bar (0–100)
* Counters:

  * total segments
  * accepted
  * rejected
  * pending
* Mini votes strip (compact visualization)
* Tile grid:

  * auto-fill columns, min tile 9px, row 14px, gap 3px, max-height 160px
  * colors:

    * keep: keep color
    * drop: drop color
    * pending: neutral
  * ring outline for current index
  * click tile jumps to segment index

### Right column: current segment card

* Time range: start → end (formatDuration)
* RMS + energy bar
* Next segment preview hint
* Waveform section with highlighted segment region:

  * `segmentStartPct` / `segmentWidthPct`
* Controls:

  * Back (undo)
  * Replay (play snippet)
  * Pause (stop)
  * Keep (primary)
  * Drop (danger)
  * Restart (reset votes + index)
  * Close

Fallback:

* If preview not ready: “Preview not ready. Generate sanitize preview first.”

---

## 10.3 Review behavior & logic

### Hotkeys

* Enter = Keep
* Space = Drop
* ArrowLeft = Back
* Esc = Close

### Auto-advance

After vote set:

* short motion timer then advance to next segment
* cancel timer on Back/Restart

### Jump logic

`jumpToSegment(index)` clamps to [0..len-1] and triggers snippet playback

### Autosave

* debounce 600ms to `api.saveSegmentReview(votes, reviewIndex, total)`
* show saving/savedAt/error states
* load existing review on open via `api.getSegmentReview()`
* `reviewSkipNextSaveRef` prevents immediate overwrite right after load

### Signature for freshness

* `reviewSignature = hash(votes)`
* `exportSignature` stored after export
* `exportNeedsRefresh = reviewSignature != exportSignature`

---

## 11) Export accepted clips (post-review)

### UX

In overlay:

* Banner if needs refresh:

  * “Votes changed. Re-export to update clips.”
* CTA: `Export accepted clips`

### Action

`exportAcceptedClips`:

1. save review first
2. `api.exportClips(votes, …)` returns:

   * clipsDir, count, sampleRate, items [{path, url}]

### After export UI

* PathRow: clipsDir + Copy (shows toast “Copied path”)
* Label: count + sampleRate
* Button: `Open first clip` (if exists)
* Update `exportSignature = reviewSignature`

### Edge cases

* 0 clips: “No accepted clips to export.”
* export fail: “Export failed. View logs.”

---

## 12) Voice Lab (iterative isolation using voice samples)

### Purpose

Use accepted segments (voice samples) to run a python iteration:

* isolate streamer voice
* output improved audio artifact
* enable A/B compare
* optionally apply as new sanitize basis/output

### Entry points

* Review overlay: `Iterate (Voice Lab)`
* Sanitize step: secondary action `Voice Lab` (optional)

---

## 12.1 Voice Lab layout (fullscreen or wide drawer)

### Section A — Inputs

* Display: “Voice samples source: Accepted segments (N)”
* Warning if N too low: “Not enough voice samples. Accept more segments.”
* Options:

  * “Remove outliers” toggle (optional)
  * Minimum sample duration threshold (optional)

### Section B — Method

* Method dropdown (v1): `Isolate streamer voice`
* Parameters (VoiceLabSettings):

  * strength
  * noiseGate
  * enhanceSpeech
  * useDemucsVocals (if available)

### Section C — Run

* CTA: `Run iteration`
* StatusCard (voiceLab job)
* Output paths:

  * isolated voice wav (path + url)
  * report json (path + url)

### Section D — Compare (A/B)

* A = current sanitize preview
* B = isolated output
* Controls:

  * toggle A/B
  * replay same segment
  * simple waveform compare
  * quick labels: duration/sampleRate

### Section E — Apply

* CTA: `Apply as new sanitize output` (explicit)
* CTA: `Create new sanitize run from output` (optional)
* Safety: do not overwrite existing sanitize outputs silently

### Edge cases

* Output missing: “Iteration produced no output. Check logs.”
* Compare disabled: “B output not available.”

---

## 13) Presets system (Sanitize + Voice Lab + Streamer Profiles)

### 13.1 Preset types

1. SanitizePreset
2. VoiceLabPreset
3. StreamerProfile (defaults + dataset context)

### 13.2 Preset model

```ts
type Preset = {
  id: string;
  type: "sanitize" | "voiceLab";
  name: string;
  description?: string;
  tags?: string[];
  scope: "global" | "streamer";
  streamerId?: string;
  isFactory?: boolean; // readonly
  params: Record<string, number | boolean | string>;
  createdAt: string;
  updatedAt: string;
  lastAppliedAt?: string;
  appliedSnapshot?: Record<string, any>; // last applied settings
  version?: number;
};
```

### 13.3 Streamer profile model

```ts
type StreamerProfile = {
  streamerId: string;
  displayName?: string;
  datasetPath: string; // e.g. dataset/<streamer>
  defaultSanitizePresetId?: string;
  defaultVoiceLabPresetId?: string;
};
```

---

## 13.4 PresetBar behavior (Sanitize & Voice Lab)

UI:
`Preset: [ Default ▼ ]  (Save) (Save as…) (Manage)`

Rules:

* Save enabled only for:

  * user presets (not factory)
  * when there are changes
* Save as… always enabled when there are valid params
* Dropdown groups:

  * Factory presets (top)
  * User presets
  * Streamer presets (when streamer context exists)

Save as… modal fields:

* Name (required)
* Tags (optional)
* Scope (global / streamer)
* If streamer scope: streamerId preselected from VOD meta context

Manage modal:

* Search
* Filters: type, scope, tags
* Actions: duplicate, rename, delete (confirm), export JSON, import JSON
* “Set as default for streamer” action when streamer context exists

---

## 14) Error handling & edge cases (master checklist)

### Global

* Backend unavailable:

  * Top banner: “Backend unavailable. Try again.”
* Job timed out:

  * StatusCard: “Timed out. View logs.”
* Artifact missing:

  * “Output file not found. Re-run step.”
* Log stream disconnected:

  * “Log stream disconnected. Retry.”

### Step 1 VOD

* URL invalid / empty
* metadata fetch fail
* missing thumb

### Step 2 Audio

* demucs missing/fails
* permission denied
* skipAAC conflict warnings

### Step 3 Sanitize

* preview decode failure
* 0 segments produced
* dirty settings not applied warning
* extreme param validation (min/max)

### Review Overlay

* preview not ready
* autosave fail with retry
* invalid votes map (offer restart)

### Export

* no accepted clips
* export dir not writable
* export signature mismatch warning

### Voice Lab

* too few samples
* method failure
* no output produced
* compare unavailable

---

## 15) Accessibility & interaction requirements (WCAG-minded)

Minimum:

* Visible focus outline for all interactive elements
* Status not conveyed by color alone (icon + text)
* Keyboard accessible:

  * Review overlay hotkeys only active when overlay focused
  * Buttons and tiles reachable via keyboard (tiles may be optional but at least segment actions must be)
* Avoid modal-only error alerts; prefer inline + console link
* Control hit targets min ~36–40px (audio controls, major buttons)

---

## 16) Microcopy library (canonical strings)

* Locked step tooltip: “Complete previous step to unlock.”
* Running helper: “Running… check Console for details.”
* Done: “Completed successfully.”
* Error: “Failed (exit {code}). View logs.”
* Dirty settings banner: “Settings changed since last run. Re-run to apply.”
* No preview: “No preview yet. Run sanitize to generate preview audio.”
* Saving review: “Saving changes…”
* Saved: “Saved at {time}.”
* Save error: “Couldn’t save review. Retry.”
* Export refresh: “Votes changed. Re-export to update clips.”
* Too few samples: “Not enough voice samples. Accept more segments to iterate.”
* No accepted clips: “No accepted clips to export.”

---

## 17) Implementation notes (handoff essentials)

### Single source of truth

* UI reads from `FlowState`
* Steps computed from `steps[]`
* Unlocks computed from `ready` chain

### Jobs pattern

* Start job → jobId
* Stream logs (SSE/websocket) → append to global buffer
* Poll job status → update step status + ready

### Artifacts contract

* Every file output should have:

  * filesystem path
  * artifact URL for UI open/preview

### Review autosave contract

* `getSegmentReview()` on open
* `saveSegmentReview()` on debounce
* signature support:

  * backend stores exportSignature after successful export

### Presets contract

* validate params on save (min/max)
* persist `appliedSnapshot` after successful runs

---

## 18) Minimal metrics hooks (optional but recommended)

* Time to complete each step
* Number of sanitize reruns
* Review completion rate
* Export re-export count (refresh effectiveness)
* Voice Lab iteration success rate

---

## 19) Deliverables summary (what dev should build)

* Wizard shell: sidebar + main + console + sticky footer
* Step pages (5) with StatusCard + action wiring
* Sanitize preview audio pipeline + waveform rendering
* Sanitize drawer
* Review overlay (tiles + segment card + hotkeys + autosave)
* Export system + freshness warnings
* Voice Lab panel with inputs/method/run/compare/apply
* Preset system:

  * UI controls (PresetBar + Manage modal)
  * storage endpoints
  * streamer defaults

---

## Appendix A — Suggested screen structure (text wireframe)

### Wizard Shell (desktop)

```
┌───────────────────────┬──────────────────────────────────────────┬───────────────────────┐
│ Steps (Sidebar)        │ Step Header + Mini Stepper               │ Console               │
│ 1 VOD   [done]         │ [Title] [Status chip]                    │ [Clear] [Collapse]    │
│ 2 Audio [done]         │ ---------------------------------------  │ --------------------- │
│ 3 Sanitize [active]    │ Main content for selected step           │ <pre>logs...</pre>    │
│ 4 SRT   [locked]       │                                          │                       │
│ 5 TTS   [locked]       │ Sticky footer: Prev / Next + helper      │                       │
└───────────────────────┴──────────────────────────────────────────┴───────────────────────┘
```

### Sanitize step (desktop)

```
Left: Presets + Settings + Plan + DiffBanner
Right: StatusCard + AudioPreview + Actions (Drawer / Review)
```

### Review overlay

```
Top bar: Title | Hotkeys | Save status | Export freshness | Export | Iterate | Close
Left: Progress + Counters + Tiles
Right: Segment card + Waveform + Controls (Back/Replay/Pause/Keep/Drop/Restart)
```

### Voice Lab

```
Inputs (accepted samples) → Method params → Run job (StatusCard) → A/B Compare → Apply
```

---

## 20) Extended implementation details (to avoid follow-up fixes)

### 20.0 Framework choice
- UI stack: React + Vite + Tailwind (utility-first) + Headless/Radix primitives for accessibility/behavior (no enforced styling). Pico.css może pozostać jako lekka baza, ale Tailwind + własne CSS variables utrzyma spójność tokenów.
- Dlaczego: przewidywalność (brak ciężkich komponentów), łatwa generacja klas, dobra dostępność (focus-trap, aria) dzięki headless prymitywom, minimalny narzut wizualny — wszystko pod kontrolą tokenów.

### 20.1 Breakpoints & layout rules
- Desktop ≥1200px: 12-col grid 3/6/3 (sidebar/main/console), outer max-width 1200px, horizontal padding 24px, vertical 24px, gaps 20–24px.
- Tablet 768–1199px: sidebar fixed 240–260px; console as bottom collapsible sheet (sticky), main full-width minus sidebar; horizontal padding 20px, gaps 16–20px.
- Mobile <768px: steps as top stepper; console as bottom sheet; main single-column; padding 16px; gaps 12–16px; overlay review stays fullscreen.
- Shell radii: cards 12px, inputs 10px, chips 999px; shells (sidebar/main) can add 12px radius + 1px border.

### 20.2 Tokens (hard numbers)
- Spacing scale: 4 / 8 / 12 / 16 / 20 / 24 / 32.
- Button heights: small 36px, default 44px; padding X 12–16px; icon buttons 36px square.
- Inputs: height 40px, padding X 12px, radius 10px; text area min-height 160–220px.
- Chips/badges: height 22–24px, padding X 8–10px, radius full.
- Tile grid (review): min col 9px, row 14px, gap 3px, max-height 160px (120px on mobile).
- Waveform: height 160px (120px mobile), bars ~240 downsampled, gap 1px, overlay segment border 1px accent 0.6, fill 10% accent.

### 20.3 Typography
- Family: "Space Grotesk", fallback "Inter"/system; Mono: "JetBrains Mono" fallback SFMono.
- Sizes/line heights: step title 24/32; section title 16/24; body 14/20; small/meta 12/16 (letter-spacing 0.08em uppercase); mono 13/18 for logs/excerpts.
- Weights: titles 600; body 400–500; chips 600.

### 20.4 Colors & states
- Backgrounds: bg #0b1220; panel #0f172a; surface #111827; overlay scrim rgba(0,0,0,0.65) + optional blur 6–8px.
- Semantic: accent #22d3ee; accentSoft #0ea5e9; success #34d399; warning #fbbf24; error #f87171; neutral text #e5e7eb; secondary text #94a3b8.
- Borders: default rgba(255,255,255,0.08); focus ring 2px accent with 3px glow rgba(accent,0.15); disabled opacity 0.45.

### 20.5 Interaction & motion
- Transitions 150–200ms ease-out on hover/focus/press; no spring/overshoot.
- Focus-visible outline on all interactive elements; status not color-only (add icon/label).
- Hit targets ≥36px (buttons, tiles optional but main controls yes).
- Skeletons: StatusCard bars, waveform placeholder, tile grid shimmer; Console “connecting…” state.

### 20.6 Validation & limits
- sanitize sliders: silenceThresholdDb [-70, -10], minSegmentMs [200, 4000], mergeGapMs [100, 1500], targetPeakDb [-18, -1], fadeMs [5, 80]; clamp + inline errors.
- VOD URL basic pattern check; block empty.
- TTS text: suggest soft limit 1000 chars, hard 2000; show counter.
- Debounce inputs (200–300ms) for sliders-to-number sync; autosave review debounce 600ms (current).
- Clear logs: confirm when a job is running.

### 20.7 Console behavior
- “Follow” toggle for autoscroll; default on when running.
- Log buffer cap (e.g., 5000 lines); if truncated show “Logs truncated at 5000 lines.”
- “View logs” anchor from StatusCards scrolls/focuses console.

### 20.8 Review & export specifics
- Export freshness: banner when reviewSignature != exportSignature; CTA re-export; after export set exportSignature.
- Autosave states: saving… / saved at HH:MM:SS / error with Retry.
- Jump-to-tile keeps snippet playback optional flag; keep/drop hotkeys only when overlay focused.
- Restart review clears votes + index; Back cancels motion timer.

### 20.9 Voice Lab safeguards
- Minimum accepted samples count (configurable, e.g., 5–10); show warning if below.
- Compare A/B: label A=current sanitize, B=isolated output; lock Apply until B exists.
- Outputs must expose artifactUrl + path for isolated wav and report json.

### 20.10 Error/empty patterns (one-liners + action)
- Backend unavailable: “Backend unavailable. Try again.”
- Artifact missing: “Output file not found. Re-run step.”
- Preview decode fail: “Preview failed to load. Check artifact URL or logs.”
- 0 segments: “No segments produced. Lower silence threshold or min length.”
- No clips to export: “No accepted clips. Keep segments first.”
- Too few samples: “Not enough voice samples. Accept more segments to iterate.”

### 20.11 Metrics hooks (suggested)
- Time per step; sanitize reruns count; review completion rate; export re-run count; voice lab success/fail; autosave failure rate; average chars per TTS.

### 20.12 API payload guidance (shape-level)
- Every job request returns: { jobId?, status, exitCode?, message?, log? }.
- Artifacts: always return { path, artifactUrl } pairs.
- Errors: { error: { code, message, details? } }.
- Review endpoints: getReview → { votes[], reviewIndex, updatedAt }; saveReview → { updatedAt }.
- Export: returns { clipsDir, count, sampleRate, items: [{ path, url }] }.
- Voice Lab: returns { output: { isolatedPath/url, reportPath/url }, status, exitCode }.

### 20.13 Accessibility specifics
- Ensure all controls have aria-label/title; tiles optionally but main actions mandatory.
- Maintain contrast ratio 4.5:1 for text; focus ring visible on dark bg.
- Do not trap hotkeys outside overlay; disable review hotkeys when overlay closed.

### 20.14 Theming
- Dark is default; light mode non-goal for v1.
- Overlay/drawer scrim rgba(0,0,0,0.65) with blur 6–8px; modal/card shadows subdued (e.g., 0 20px 50px -24 rgba(0,0,0,0.5)).

### 20.15 File/path constraints
- Note large VOD sizes; warn if preview fetch exceeds threshold (optional);
- Export clips sampleRate consistent with sanitize output; min clip length (e.g., 0.15s) already enforced in snippets.

```

If chcesz, w kolejnym kroku przerobię to na **finalny plik repo** w stylu, który lubisz (np. sekcje pod implementację: *Components*, *Screens*, *State & API*, *Edge cases*, *Microcopy*), albo dopiszę **pełne JSON przykłady payloadów** dla wszystkich endpointów (checkVod/runAudio/runSanitize/runSrt/runTts/getReview/saveReview/exportClips/voiceLab/presets).
```
