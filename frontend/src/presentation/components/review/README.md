# Review Components Integration Guide

Complete React implementation of the hybrid review system with Table, Focus, and Timeline views.

> **⚠️ Important:** Remember to import the CSS file in your app:
> ```tsx
> import '@/presentation/components/review/review-views.css';
> ```

## Components Overview

### 1. TableView
**Main grid interface for bulk operations**
- Dense data table with sortable columns
- Checkbox selection for bulk actions
- Inline text editing
- Status badges and metrics display
- Double-click to open Focus view

### 2. FocusView
**Modal for detailed single-segment review**
- Large waveform visualization
- Collapsible original audio comparison (toggle with 'O' key)
- Playback controls with speed adjustment (0.5x - 1.5x)
- Keyboard shortcuts (A/R/S/O/Space/Arrows/Esc)
- Navigation with auto-advance on accept/reject
- Progress tracking

### 3. TimelineView
**Alternative horizontal scrolling timeline**
- Card-based layout with mini waveforms
- Visual browsing with metrics
- Quick actions on each card
- Good for visual exploration

### 4. ReviewManager
**Integrated component managing all views**
- View mode switcher (Table ↔ Timeline)
- Unified state management
- Bulk operations toolbar
- Focus view modal overlay

## Quick Start

### Basic Usage

```tsx
import { ReviewManager } from '@/presentation/components/review';

function ManualReviewPage() {
  const [segments, setSegments] = useState<FocusViewSegment[]>([]);

  const handleSegmentUpdate = (index: number, updates: Partial<FocusViewSegment>) => {
    setSegments(prev => prev.map(seg => 
      seg.index === index ? { ...seg, ...updates } : seg
    ));
  };

  const handleSegmentAction = (index: number, action: 'accept' | 'reject' | 'skip') => {
    console.log(`Segment ${index} ${action}ed`);
    // Implement your action logic here
  };

  return (
    <ReviewManager
      segments={segments}
      onSegmentUpdate={handleSegmentUpdate}
      onSegmentAction={handleSegmentAction}
    />
  );
}
```

### Individual Components

```tsx
import { TableView, FocusView, TimelineView } from '@/presentation/components/review';

// Use TableView standalone
<TableView
  segments={segments}
  selectedSegments={selectedSet}
  onSelectSegment={(index, selected) => console.log(index, selected)}
  onSelectAll={(selected) => console.log('Select all:', selected)}
  onDoubleClick={(segment) => console.log('Open focus:', segment)}
  onSegmentAction={(index, action) => console.log(index, action)}
  onTextEdit={(index, text) => console.log(index, text)}
/>

// Use FocusView standalone
<FocusView
  segment={focusedSegment}
  totalSegments={segments.length}
  onClose={() => setFocusedSegmentIndex(null)}
  onNavigate={(direction) => navigate(direction)}
  onTextEdit={(text) => updateText(text)}
  onAction={(action) => handleAction(action)}
/>

// Use TimelineView standalone
<TimelineView
  segments={segments}
  onSegmentClick={(segment) => console.log('Clicked:', segment)}
  onSegmentAction={(index, action) => console.log(index, action)}
/>
```

## Data Structures

### FocusViewSegment (Complete)
```typescript
interface FocusViewSegment {
  index: number;
  start: number;
  end: number;
  duration: number;
  text: string;
  confidence?: number;          // 0-100
  snrDb?: number;               // Signal-to-noise ratio
  speechRatio?: number;         // 0-100
  kept?: boolean | null;        // null = review, true = accepted, false = rejected
  rejectReason?: string[];
  // Focus view specific:
  cleanAudioUrl?: string;       // URL to cleaned audio file
  originalAudioUrl?: string;    // URL to original audio file
  originalSnrDb?: number;       // Original SNR for comparison
  originalSpeechRatio?: number; // Original speech ratio for comparison
}
```

### TableViewSegment (Subset)
Same as FocusViewSegment but without `cleanAudioUrl`, `originalAudioUrl`, `originalSnrDb`, `originalSpeechRatio`.

### TimelineSegment (Subset)
Same as TableViewSegment.

## Integration with Existing Code

### Step 1: Import and Add Styles

```tsx
// In manual-review.page.tsx
import '@/presentation/components/review/review-views.css';
import { ReviewManager } from '@/presentation/components/review';
```

### Step 2: Map Existing Segment Data

If you have existing `SegmentItem` type, create a mapping function:

```typescript
import { FocusViewSegment } from '@/presentation/components/review';

function mapToReviewSegment(item: SegmentItem): FocusViewSegment {
  return {
    index: item.index,
    start: item.start,
    end: item.end,
    duration: item.end - item.start,
    text: item.text,
    confidence: item.confidence,
    snrDb: item.snr_db,
    speechRatio: item.speech_ratio,
    kept: item.kept,
    rejectReason: item.reject_reason,
    cleanAudioUrl: item.clean_audio_url,
    originalAudioUrl: item.original_audio_url,
    originalSnrDb: item.original_snr_db,
    originalSpeechRatio: item.original_speech_ratio,
  };
}

// Use it:
const reviewSegments = segments.map(mapToReviewSegment);
```

### Step 3: Replace Existing List

Replace your current segment list rendering:

```tsx
// Before:
<div className="segments-list">
  {segments.map(segment => (
    <SegmentCard key={segment.index} segment={segment} />
  ))}
</div>

// After:
<ReviewManager
  segments={reviewSegments}
  onSegmentUpdate={handleSegmentUpdate}
  onSegmentAction={handleSegmentAction}
/>
```

## Keyboard Shortcuts (Focus View)

| Key | Action |
|-----|--------|
| **A** | Accept segment |
| **R** | Reject segment |
| **S** | Skip to next |
| **O** | Toggle original audio |
| **Space** | Play/pause |
| **←** | Previous segment |
| **→** | Next segment |
| **Esc** | Close focus view |

## Audio Integration

The components expect audio URLs. If using existing Waveform component:

```tsx
// Generate audio URLs from segment data
const cleanAudioUrl = `/api/audio/clean/${runId}/${segment.index}`;
const originalAudioUrl = `/api/audio/original/${runId}/${segment.index}`;
```

For actual playback, you can:
1. Use HTML5 audio elements (already implemented in FocusView)
2. Integrate with existing Waveform component
3. Use WaveSurfer.js directly

## State Management

### Option 1: Local React State (Simple)
```tsx
const [segments, setSegments] = useState<FocusViewSegment[]>([]);
```

### Option 2: Zustand Store (Recommended)
```tsx
// In useReviewStore.ts
interface ReviewStore {
  segments: FocusViewSegment[];
  selectedSegments: Set<number>;
  updateSegment: (index: number, updates: Partial<FocusViewSegment>) => void;
  setSelected: (indices: Set<number>) => void;
}

export const useReviewStore = create<ReviewStore>((set) => ({
  segments: [],
  selectedSegments: new Set(),
  updateSegment: (index, updates) => set((state) => ({
    segments: state.segments.map(seg => 
      seg.index === index ? { ...seg, ...updates } : seg
    )
  })),
  setSelected: (indices) => set({ selectedSegments: indices }),
}));
```

### Option 3: Existing useTranscriptionFeedStore
If you already have a transcription store, extend it:

```typescript
// Add to existing store:
interface TranscriptionFeedStore {
  // ... existing fields
  reviewSegments: FocusViewSegment[];
  selectedForReview: Set<number>;
  updateReviewSegment: (index: number, updates: Partial<FocusViewSegment>) => void;
}
```

## Styling Customization

The CSS file uses CSS variables for easy theming:

```css
:root {
  --color-bg-dark: #0e1117;
  --color-bg-card: #1a1e26;
  --color-border: #2a2f3a;
  --color-text: #e3e8f0;
  --color-text-muted: #a3adbf;
  --color-primary: #4a9eff;
  --color-success: #4ade80;
  --color-danger: #f87171;
  --color-warning: #fbbf24;
}
```

Override in your own CSS:

```css
/* In your custom.css */
:root {
  --color-primary: #your-color;
}
```

## Advanced Features

### Bulk Operations
```tsx
<ReviewManager
  segments={segments}
  onSegmentUpdate={handleSegmentUpdate}
  onSegmentAction={(index, action) => {
    if (action === 'accept') {
      // Batch accept logic
      acceptSegment(index);
    } else if (action === 'reject') {
      // Batch reject logic
      rejectSegment(index);
    }
  }}
/>
```

### Filtering
```tsx
const [filter, setFilter] = useState<'all' | 'review' | 'accepted' | 'rejected'>('all');

const filteredSegments = segments.filter(seg => {
  if (filter === 'review') return seg.kept === null;
  if (filter === 'accepted') return seg.kept === true;
  if (filter === 'rejected') return seg.kept === false;
  return true;
});

<ReviewManager segments={filteredSegments} ... />
```

### Sorting
```tsx
const [sortBy, setSortBy] = useState<'index' | 'confidence' | 'snr' | 'duration'>('index');

const sortedSegments = [...segments].sort((a, b) => {
  switch (sortBy) {
    case 'confidence': return (b.confidence || 0) - (a.confidence || 0);
    case 'snr': return (b.snrDb || 0) - (a.snrDb || 0);
    case 'duration': return b.duration - a.duration;
    default: return a.index - b.index;
  }
});
```

## Migration Checklist

- [ ] Import ReviewManager and CSS
- [ ] Map existing segment data to FocusViewSegment format
- [ ] Replace segment list with ReviewManager
- [ ] Connect audio URL generation
- [ ] Implement onSegmentUpdate handler
- [ ] Implement onSegmentAction handler
- [ ] Test Table view (selection, editing, actions)
- [ ] Test Focus view (keyboard shortcuts, navigation)
- [ ] Test Timeline view (scrolling, cards)
- [ ] Test View switching
- [ ] Test Bulk operations
- [ ] Test Audio playback (clean + original)
- [ ] Add filtering/sorting if needed
- [ ] Connect to backend API for persistence

## Troubleshooting

### Audio not playing
- Check audio URLs are valid and accessible
- Check browser console for CORS errors
- Ensure audio files are in supported format (mp3, wav, ogg)

### Focus view not opening
- Verify onDoubleClick handler is connected
- Check focusedSegmentIndex state is set correctly
- Ensure segment has all required fields

### Keyboard shortcuts not working
- Focus view must have focus (click inside)
- Check for conflicting global shortcuts
- Ensure event.preventDefault() is called

## Next Steps

1. Integrate with existing manual-review.page.tsx
2. Connect to backend API for audio URLs
3. Add persistence (save accept/reject decisions)
4. Implement filtering and sorting
5. Add progress tracking across sessions
6. Consider adding batch processing queue

## Architecture

```
ReviewManager (Parent)
├── View Switcher (Table ↔ Timeline)
├── Bulk Actions Toolbar (when segments selected)
├── TableView (Main)
│   ├── Sortable headers
│   ├── Checkbox selection
│   ├── Inline editing
│   └── Double-click → FocusView
├── TimelineView (Alternative)
│   ├── Horizontal scroll
│   ├── Card layout
│   └── Click → FocusView
└── FocusView (Modal overlay)
    ├── Large waveform
    ├── Original audio section (collapsible)
    ├── Keyboard shortcuts
    └── Navigation (prev/next)
```

## File Structure

```
frontend/src/presentation/components/review/
├── TableView.tsx           # Main grid view
├── FocusView.tsx           # Modal focus view
├── TimelineView.tsx        # Horizontal timeline
├── ReviewManager.tsx       # Integration component
├── review-views.css        # Unified styles
├── index.ts                # Export index
└── README.md               # This file
```
