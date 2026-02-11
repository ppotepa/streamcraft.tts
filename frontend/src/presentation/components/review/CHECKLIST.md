# Review System Integration Checklist

Use this checklist to track your integration progress.

## ✅ Pre-Integration (Complete)
- [x] TableView component created (180 lines)
- [x] FocusView component created (365 lines)
- [x] TimelineView component created (145 lines)
- [x] ReviewManager component created (124 lines)
- [x] CSS styling complete (820 lines)
- [x] Export index created
- [x] Documentation written
- [x] All TypeScript errors resolved
- [x] Example integration code provided

## 📋 Integration Steps (To Do)

### Phase 1: Setup (10 minutes)
- [ ] **Import CSS in your app**
  ```tsx
  import '@/presentation/components/review/review-views.css';
  ```
  Location: `main.tsx` or `manual-review.page.tsx`

- [ ] **Import ReviewManager**
  ```tsx
  import { ReviewManager } from '@/presentation/components/review';
  ```

### Phase 2: Data Mapping (15 minutes)
- [ ] **Create mapper function**
  - Map your `SegmentItem` to `FocusViewSegment`
  - Add audio URL generation logic
  - Test with sample data
  
- [ ] **Verify field mapping**
  - [ ] index ✓
  - [ ] start ✓
  - [ ] end ✓
  - [ ] duration ✓
  - [ ] text ✓
  - [ ] confidence (optional)
  - [ ] snrDb (optional)
  - [ ] speechRatio (optional)
  - [ ] kept (null/true/false)
  - [ ] cleanAudioUrl
  - [ ] originalAudioUrl

### Phase 3: Handlers (20 minutes)
- [ ] **Implement onSegmentUpdate**
  - Update local/store state
  - Add backend persistence (optional)
  - Handle errors gracefully

- [ ] **Implement onSegmentAction**
  - Handle 'accept' action
  - Handle 'reject' action
  - Handle 'skip' action
  - Add backend calls (optional)

### Phase 4: Component Replacement (10 minutes)
- [ ] **Replace existing segment list**
  - Comment out old implementation
  - Add ReviewManager component
  - Pass props (segments, handlers)

- [ ] **Test rendering**
  - [ ] Components render without errors
  - [ ] Segments display correctly
  - [ ] No console errors

### Phase 5: Testing - Table View (15 minutes)
- [ ] **Basic functionality**
  - [ ] Segments display in table
  - [ ] Status badges show correctly
  - [ ] Metrics display with colors

- [ ] **Selection**
  - [ ] Individual checkbox works
  - [ ] Select all checkbox works
  - [ ] Indeterminate state works
  - [ ] Selected count updates

- [ ] **Interactions**
  - [ ] Double-click opens Focus view
  - [ ] Inline text editing works
  - [ ] Action buttons work (Play/Accept/Reject)

- [ ] **Sorting**
  - [ ] Column headers show sort indicators
  - [ ] Click to sort (if implemented)

### Phase 6: Testing - Focus View (20 minutes)
- [ ] **Modal behavior**
  - [ ] Opens on double-click
  - [ ] Closes on X button
  - [ ] Closes on Esc key
  - [ ] Backdrop click closes (optional)

- [ ] **Keyboard shortcuts**
  - [ ] A - Accept segment
  - [ ] R - Reject segment
  - [ ] S - Skip to next
  - [ ] O - Toggle original audio
  - [ ] Space - Play/pause
  - [ ] ← - Previous segment
  - [ ] → - Next segment
  - [ ] Esc - Close modal

- [ ] **Navigation**
  - [ ] Previous button works
  - [ ] Next button works
  - [ ] Auto-advance on accept/reject
  - [ ] Boundary checks (first/last segment)

- [ ] **Audio**
  - [ ] Clean audio loads
  - [ ] Clean audio plays
  - [ ] Original audio loads (when toggled)
  - [ ] Original audio plays
  - [ ] Playback speed controls work
  - [ ] No CORS errors

- [ ] **Editing**
  - [ ] Text editor works
  - [ ] Text saves on blur
  - [ ] onTextEdit callback fires

- [ ] **UI**
  - [ ] Progress bar shows correct position
  - [ ] Metrics display correctly
  - [ ] Comparison metrics show (if original data available)
  - [ ] Keyboard shortcuts panel visible

### Phase 7: Testing - Timeline View (10 minutes)
- [ ] **Basic functionality**
  - [ ] Cards display in timeline
  - [ ] Mini waveforms render
  - [ ] Metrics show on cards

- [ ] **Interactions**
  - [ ] Horizontal scroll works
  - [ ] Card hover effects work
  - [ ] Click opens Focus view
  - [ ] Action buttons work

### Phase 8: Testing - View Switching (5 minutes)
- [ ] **View switcher**
  - [ ] Table/Timeline toggle works
  - [ ] View mode persists
  - [ ] State preserved during switch

### Phase 9: Testing - Bulk Operations (10 minutes)
- [ ] **Bulk actions toolbar**
  - [ ] Appears when segments selected
  - [ ] Shows correct count
  - [ ] Bulk Accept works
  - [ ] Bulk Reject works
  - [ ] Selection clears after action

### Phase 10: Backend Integration (Optional, 30 minutes)
- [ ] **API endpoints**
  - [ ] GET /api/segments/:runId
  - [ ] PUT /api/segments/:runId/:index
  - [ ] POST /api/segments/:runId/batch
  - [ ] GET /api/audio/clean/:runId/:index
  - [ ] GET /api/audio/original/:runId/:index

- [ ] **CORS configuration**
  - [ ] Audio files accessible
  - [ ] API calls work from frontend
  - [ ] No CORS errors

- [ ] **Error handling**
  - [ ] Network errors caught
  - [ ] User-friendly error messages
  - [ ] Retry logic (optional)

### Phase 11: Advanced Features (Optional, 60 minutes)
- [ ] **Filtering**
  - [ ] Filter by status (all/review/accepted/rejected)
  - [ ] Filter by quality thresholds
  - [ ] Filter UI implemented

- [ ] **Sorting**
  - [ ] Sort by index
  - [ ] Sort by confidence
  - [ ] Sort by SNR
  - [ ] Sort by duration

- [ ] **Progress tracking**
  - [ ] Save progress to backend
  - [ ] Resume from last position
  - [ ] Show completion percentage

- [ ] **Undo/Redo**
  - [ ] Undo last action
  - [ ] Redo action
  - [ ] Action history

### Phase 12: Polish (30 minutes)
- [ ] **Loading states**
  - [ ] Show spinner while loading segments
  - [ ] Show skeleton UI (optional)

- [ ] **Empty states**
  - [ ] No segments message
  - [ ] Call-to-action button

- [ ] **Error states**
  - [ ] Failed to load segments
  - [ ] Failed to play audio
  - [ ] Network error handling

- [ ] **Accessibility**
  - [ ] Test with keyboard only
  - [ ] Test with screen reader
  - [ ] Check color contrast

- [ ] **Responsive design**
  - [ ] Test on mobile
  - [ ] Test on tablet
  - [ ] Test on desktop

### Phase 13: Performance (Optional, 30 minutes)
- [ ] **Large datasets**
  - [ ] Test with 100+ segments
  - [ ] Test with 500+ segments
  - [ ] Consider virtual scrolling if slow

- [ ] **Optimization**
  - [ ] Memoize expensive calculations
  - [ ] Debounce text editing
  - [ ] Lazy load audio files

## 📊 Progress Tracking

**Integration Status:** 0% (0/13 phases complete)

**Estimated Total Time:** 3-4 hours for basic integration, 5-6 hours with advanced features

**Completion Date:** _________________

## 🎯 MVP Definition

Minimum viable product requires:
- ✅ Phase 1: Setup
- ✅ Phase 2: Data Mapping
- ✅ Phase 3: Handlers
- ✅ Phase 4: Component Replacement
- ✅ Phase 5: Table View Testing
- ✅ Phase 6: Focus View Testing (basic)

Everything else is optional but recommended for production.

## 🐛 Known Issues / Notes

Track any issues you encounter during integration:

```
Issue 1: [Description]
Solution: [What fixed it]

Issue 2: [Description]
Solution: [What fixed it]
```

## 📞 Need Help?

Refer to these files:
- `README.md` - Integration guide with examples
- `IMPLEMENTATION.md` - Complete feature list and architecture
- `example-integration.tsx` - Copy-paste example code

## ✨ Post-Integration

After successful integration, consider:
- [ ] Add unit tests for handlers
- [ ] Add E2E tests for user flows
- [ ] Document custom modifications
- [ ] Train team on keyboard shortcuts
- [ ] Gather user feedback
- [ ] Plan future enhancements
