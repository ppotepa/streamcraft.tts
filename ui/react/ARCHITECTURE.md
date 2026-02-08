# Domain-Driven Architecture

## Structure Overview

```
src/
├── steps/                          # Main workflow steps (domain features)
│   └── segment-review/
│       ├── index.ts               # Public API
│       ├── SegmentReview.tsx      # Step shell (state, logic, composition)
│       ├── viewer/                # Viewer subcomponents
│       │   ├── index.tsx          # Main viewer composition
│       │   ├── TileView.tsx       # Tinder-style tile grid
│       │   ├── Timeline.tsx       # Segment timeline bar
│       │   └── PlayerPanel.tsx    # Audio player + controls
│       └── sidebar/               # Sidebar subcomponents
│           ├── index.ts
│           └── AcceptedList.tsx   # Accepted segments list
│
├── features/                      # App-level features
│   └── job-management/
│       ├── index.ts               # Public API
│       ├── JobsList.tsx           # List container
│       ├── JobCard.tsx            # Single job card
│       ├── JobProgress.tsx        # Progress indicators
│       ├── EmptyJobs.tsx          # Empty state
│       └── jobUtils.ts            # Utility functions
│
├── shared/                        # Reusable components
│   ├── media/
│   │   ├── AudioPlayer.tsx
│   │   └── WaveformBars.tsx
│   ├── feedback/
│   │   ├── Toast.tsx
│   │   └── DiffBanner.tsx
│   ├── navigation/
│   │   └── FooterNav.tsx
│   ├── forms/
│   │   ├── PathRow.tsx
│   │   └── SettingsRow.tsx
│   ├── data-display/
│   │   ├── StatusCard.tsx
│   │   └── EmptyState.tsx
│   ├── utils/
│   │   ├── index.ts
│   │   └── useHotkeys.ts          # Keyboard shortcut hook
│   └── hooks/
│       ├── index.ts
│       ├── useKeyboardShortcuts.ts # Generic keyboard handler
│       └── useLogger.ts           # Console logging hook
│
└── components/                    # Legacy (backward compatibility)
    ├── SegmentReview.tsx          # Redirects to steps/segment-review
    ├── JobList.tsx                # Redirects to features/job-management
    └── _legacy-exports.ts         # Re-exports for old imports
```

## Key Principles

### 1. Step-Based Organization
Each major workflow (segment-review, voice-lab, jobs) lives in `steps/` with:
- **Main component**: Owns state, logic, keyboard handling
- **Subfolders**: Organized by UI concern (viewer, sidebar, controls)
- **index.ts**: Clean public API

### 2. Shared Components
Reusable pieces organized by function:
- **media**: Audio/video/waveform components
- **feedback**: Toasts, banners, notifications
- **navigation**: Footers, menus, steppers
- **forms**: Input rows, settings controls
- **data-display**: Cards, lists, empty states
- **utils**: Hooks, helpers, types

### 3. Backward Compatibility
- Old imports still work via `_legacy-exports.ts`
- Gradual migration path for existing code

## Example: Segment Review

### Before
```tsx
SegmentReview.tsx (400+ lines)
├── renderTiles()
├── renderTimeline()
├── renderPlayer()
└── renderSidebarList()
```

### After
```tsx
steps/segment-review/
├── SegmentReview.tsx              # 200 lines: state + composition
├── viewer/
│   ├── index.tsx                  # Compose: tiles + timeline + player
│   ├── TileView.tsx               # 40 lines
│   ├── Timeline.tsx               # 50 lines
│   └── PlayerPanel.tsx            # 80 lines
└── sidebar/
    └── AcceptedList.tsx           # 80 lines
```

## Example: Job Management

### Before
```tsx
JobList.tsx (114 lines)
├── getLastStep()
├── getProgressPercent()
├── formatDate()
├── Empty state inline
└── Job card render (60+ lines inline)
```

### After
```tsx
features/job-management/
├── JobsList.tsx                   # 30 lines: list wrapper
├── JobCard.tsx                    # 60 lines: single job
├── JobProgress.tsx                # 25 lines: progress bars
├── EmptyJobs.tsx                  # 10 lines: empty state
└── jobUtils.ts                    # 50 lines: utility functions
```

### Benefits
✓ Each file has single responsibility
✓ Easy to test components in isolation
✓ Clear dependencies (imports show relationships)
✓ Reusable Timeline/Player for other steps
✓ Shared useHotkeys for consistent shortcuts
✓ JobCard reusable in different contexts
✓ Progress component can be used elsewhere

## Migration Guide

### Adding New Steps
1. Create `steps/[step-name]/`
2. Add main component with state/logic
3. Extract UI into subfolders (controls, panels, etc.)
4. Export via `index.ts`

### Moving Shared Components
1. Identify reusable piece
2. Move to appropriate `shared/` subfolder
3. Add to subfolder's `index.ts`
4. Update imports (or add to `_legacy-exports.ts`)

### Using Shared Utilities
```tsx
import { useHotkeys } from '../../shared/utils';

useHotkeys({
  Enter: () => handleAccept(),
  Space: () => handleReject(),
});
```
