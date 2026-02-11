/**
 * INTEGRATION EXAMPLE
 * 
 * ⚠️ This is an EXAMPLE file - not meant to be compiled directly!
 * Copy the code patterns from this file into your actual implementation.
 * Adjust import paths to match your project structure.
 * 
 * This file demonstrates how to integrate the ReviewManager component
 * into your existing manual-review.page.tsx file.
 * 
 * Follow the numbered steps below:
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// STEP 1: Add imports
// ============================================================================
import { useState } from 'react';
import type { FocusViewSegment } from './index';
// In your actual file, use:
// import { ReviewManager, FocusViewSegment } from '@/presentation/components/review';
// import '@/presentation/components/review/review-views.css';

// ============================================================================
// STEP 2: Create a mapper function for your existing segment data
// ============================================================================

/**
 * Map your existing SegmentItem to FocusViewSegment format
 * Adjust the field names to match your existing data structure
 */
function mapToReviewSegment(item: any, runId: string): FocusViewSegment {
    return {
        // Required fields
        index: item.index,
        start: item.start,
        end: item.end,
        duration: item.end - item.start,
        text: item.text,

        // Optional quality metrics
        confidence: item.confidence,           // 0-100
        snrDb: item.snr_db,                   // Signal-to-noise ratio
        speechRatio: item.speech_ratio,        // 0-100

        // Review status
        kept: item.kept,                       // true = accepted, false = rejected, null = pending
        rejectReason: item.reject_reason,      // Array of rejection reasons

        // Audio URLs (construct these based on your API endpoints)
        cleanAudioUrl: `/api/audio/clean/${runId}/${item.index}.mp3`,
        originalAudioUrl: `/api/audio/original/${runId}/${item.index}.mp3`,

        // Original metrics for comparison (if available)
        originalSnrDb: item.original_snr_db,
        originalConfidence: item.original_confidence,
        originalSpeechRatio: item.original_speech_ratio,
    };
}

// ============================================================================
// STEP 3: Use ReviewManager in your component
// ============================================================================

export function ManualReviewPageExample() {
    // Your existing state
    const [runId] = useState('run-123');
    const [segments, setSegments] = useState<any[]>([]);

    // Convert your segments to review format
    const reviewSegments = segments.map(seg => mapToReviewSegment(seg, runId));

    // ========================================================================
    // STEP 4: Implement update handler
    // ========================================================================
    const handleSegmentUpdate = (index: number, updates: Partial<FocusViewSegment>) => {
        setSegments(prevSegments =>
            prevSegments.map(seg =>
                seg.index === index
                    ? { ...seg, ...updates }
                    : seg
            )
        );

        // Optional: Persist to backend
        // await api.updateSegment(runId, index, updates);
    };

    // ========================================================================
    // STEP 5: Implement action handler
    // ========================================================================
    const handleSegmentAction = (index: number, action: 'accept' | 'reject' | 'skip') => {
        if (action === 'accept') {
            handleSegmentUpdate(index, { kept: true, rejectReason: [] });

            // Optional: Send to backend
            // await api.acceptSegment(runId, index);

        } else if (action === 'reject') {
            handleSegmentUpdate(index, {
                kept: false,
                rejectReason: ['manually_rejected']
            });

            // Optional: Send to backend
            // await api.rejectSegment(runId, index, ['manually_rejected']);

        } else if (action === 'skip') {
            // Skip to next without changing state
            console.log(`Skipped segment ${index}`);
        }
    };

    // ========================================================================
    // STEP 6: Render the ReviewManager
    // ========================================================================
    return (
        <div className="manual-review-page">
            <header>
                <h1>Manual Review - {runId}</h1>
            </header>

            <main>
                {/* Replace your existing segment list with ReviewManager */}
                {/* In your actual implementation, uncomment and use:
                <ReviewManager
                    segments={reviewSegments}
                    onSegmentUpdate={handleSegmentUpdate}
                    onSegmentAction={handleSegmentAction}
                />
                */}
            </main>
        </div>
    );
}

// ============================================================================
// ADVANCED: Add filtering and sorting
// ============================================================================

export function ManualReviewPageWithFilters() {
    const [runId] = useState('run-123');
    const [segments, setSegments] = useState<any[]>([]);
    const [filter, setFilter] = useState<'all' | 'review' | 'accepted' | 'rejected'>('all');
    const [sortBy, setSortBy] = useState<'index' | 'confidence' | 'snr'>('index');

    // Apply filtering
    const filteredSegments = segments.filter(seg => {
        if (filter === 'review') return seg.kept === null;
        if (filter === 'accepted') return seg.kept === true;
        if (filter === 'rejected') return seg.kept === false;
        return true; // 'all'
    });

    // Apply sorting
    const sortedSegments = [...filteredSegments].sort((a, b) => {
        switch (sortBy) {
            case 'confidence':
                return (b.confidence || 0) - (a.confidence || 0);
            case 'snr':
                return (b.snr_db || 0) - (a.snr_db || 0);
            case 'index':
            default:
                return a.index - b.index;
        }
    });

    const reviewSegments = sortedSegments.map(seg => mapToReviewSegment(seg, runId));

    const handleSegmentUpdate = (index: number, updates: Partial<FocusViewSegment>) => {
        setSegments(prev => prev.map(seg =>
            seg.index === index ? { ...seg, ...updates } : seg
        ));
    };

    const handleSegmentAction = (index: number, action: 'accept' | 'reject' | 'skip') => {
        if (action === 'accept') {
            handleSegmentUpdate(index, { kept: true });
        } else if (action === 'reject') {
            handleSegmentUpdate(index, { kept: false, rejectReason: ['manually_rejected'] });
        }
    };

    return (
        <div className="manual-review-page">
            <header>
                <h1>Manual Review - {runId}</h1>

                {/* Filters and sorting */}
                <div className="controls">
                    <select value={filter} onChange={e => setFilter(e.target.value as any)}>
                        <option value="all">All Segments</option>
                        <option value="review">Pending Review</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                    </select>

                    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                        <option value="index">Sort by Index</option>
                        <option value="confidence">Sort by Confidence</option>
                        <option value="snr">Sort by SNR</option>
                    </select>
                </div>
            </header>

            <main>
                {/* In your actual implementation, uncomment and use:
                <ReviewManager
                    segments={reviewSegments}
                    onSegmentUpdate={handleSegmentUpdate}
                    onSegmentAction={handleSegmentAction}
                />
                */}
            </main>
        </div>
    );
}

// ============================================================================
// TIPS & BEST PRACTICES
// ============================================================================

/*
1. **Audio URLs**: Make sure your backend serves audio files at the URLs you provide
   - Example: GET /api/audio/clean/:runId/:segmentIndex.mp3
   - Ensure CORS headers are set if frontend/backend are on different domains

2. **State Management**: For larger apps, consider using Zustand or Redux:
   
   ```tsx
   import { useReviewStore } from '@/stores/reviewStore';
   
   const { segments, updateSegment, acceptSegment } = useReviewStore();
   ```

3. **Persistence**: Save changes to backend immediately or batch them:
   
   ```tsx
   // Immediate save
   const handleSegmentAction = async (index, action) => {
       await api.updateSegment(runId, index, { kept: action === 'accept' });
       handleSegmentUpdate(index, { kept: action === 'accept' });
   };
   
   // Batch save (when user clicks "Save All")
   const handleSaveAll = async () => {
       await api.batchUpdateSegments(runId, segments);
   };
   ```

4. **Loading States**: Show loading indicators while fetching segments:
   
   ```tsx
   const [loading, setLoading] = useState(true);
   
   useEffect(() => {
       fetchSegments(runId).then(data => {
           setSegments(data);
           setLoading(false);
       });
   }, [runId]);
   
   if (loading) return <LoadingSpinner />;
   ```

5. **Error Handling**: Handle API errors gracefully:
   
   ```tsx
   const handleSegmentAction = async (index, action) => {
       try {
           await api.updateSegment(runId, index, { kept: action === 'accept' });
           handleSegmentUpdate(index, { kept: action === 'accept' });
       } catch (error) {
           console.error('Failed to update segment:', error);
           // Show error toast/notification
           showError('Failed to update segment. Please try again.');
       }
   };
   ```

6. **Keyboard Shortcuts**: Focus view has built-in shortcuts:
   - A: Accept
   - R: Reject
   - S: Skip
   - O: Toggle original audio
   - Space: Play/pause
   - ←/→: Navigate
   - Esc: Close

7. **Performance**: For 1000+ segments, consider:
   - Virtual scrolling (react-window or react-virtualized)
   - Pagination
   - Lazy loading segments in batches

8. **Accessibility**: Components include:
   - Semantic HTML
   - Keyboard navigation
   - ARIA labels
   - Screen reader support

9. **Customization**: Override CSS variables:
   
   ```css
   :root {
       --color-primary: #your-color;
       --color-success: #your-color;
   }
   ```

10. **Testing**: Test these scenarios:
    - Empty state (no segments)
    - Single segment
    - Large dataset (100+ segments)
    - Keyboard navigation
    - Audio playback
    - Bulk operations
*/
