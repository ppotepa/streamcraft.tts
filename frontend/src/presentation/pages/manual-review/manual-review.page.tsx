/**
 * Manual Review Page
 * Rich approve/reject view for sanitized segments.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { config } from '../../../config';
import { ReviewManager, FocusViewSegment } from '../../components/review';

type SegmentItem = {
    index: number;
    start: number;
    end: number;
    duration: number;
    cleanStart?: number | null;
    cleanEnd?: number | null;
    kept?: boolean | null;
    quality?: number | null;
    speechRatio?: number | null;
    snrDb?: number | null;
    clipRatio?: number | null;
    sfxScore?: number | null;
    speakerSim?: number | null;
    labels: string[];
    rejectReason: string[];
};

type ReviewVote = {
    index: number;
    decision: 'accept' | 'reject';
    segment: SegmentItem;
    note?: string | null;
};

type ReviewState = {
    totalSegments: number;
    reviewIndex: number;
    accepted: number;
    rejected: number;
    votes: ReviewVote[];
    updatedAt?: string | null;
};

type SegmentManifestResponse = {
    sampleRate: number;
    cleanPath?: string | null;
    originalPath?: string | null;
    segments: SegmentItem[];
    total?: number | null;
    offset?: number | null;
    limit?: number | null;
    hasMore?: boolean | null;
};

type ManualReviewPageProps = {
    vodUrlOverride?: string;
};

type HistoryEntry = {
    index: number;
    prevDecision: 'accept' | 'reject' | null;
};

const ManualReviewPanel: React.FC<{ vodUrl: string }> = ({ vodUrl }) => {

    const [segments, setSegments] = useState<SegmentItem[]>([]);
    const [cleanPath, setCleanPath] = useState<string | null>(null);
    const [originalPath, setOriginalPath] = useState<string | null>(null);
    const [votes, setVotes] = useState<Record<number, 'accept' | 'reject'>>({});
    const [notes, setNotes] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reviewMeta, setReviewMeta] = useState<ReviewState | null>(null);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [totalSegments, setTotalSegments] = useState(0);
    const [pageOffset, setPageOffset] = useState(0);
    const [pageLimit, setPageLimit] = useState(200);
    const [hasMore, setHasMore] = useState(false);
    const [showTimeline, setShowTimeline] = useState(() => {
        const stored = localStorage.getItem('reviewShowTimeline');
        return stored !== null ? stored === 'true' : true;
    });
    const [showTrays, setShowTrays] = useState(() => {
        const stored = localStorage.getItem('reviewShowTrays');
        return stored !== null ? stored === 'true' : true;
    });
    const [perfMode, setPerfMode] = useState(() => {
        const stored = localStorage.getItem('reviewPerfMode');
        return stored !== null ? stored === 'true' : false;
    });
    const [suggestionRunning, setSuggestionRunning] = useState(false);
    const [suggestionMessage, setSuggestionMessage] = useState<string | null>(null);

    const votesRef = useRef<Record<number, 'accept' | 'reject'>>({});

    const baseUrl = config.apiBaseUrl.replace(/\/$/, '');

    const getArtifactUrl = useCallback(
        (path: string) => `${baseUrl}/legacy/artifact?path=${encodeURIComponent(path)}`,
        [baseUrl]
    );

    const fetchSegments = async (nextOffset = 0, nextLimit = pageLimit): Promise<void> => {
        if (!vodUrl) {
            setError('Provide vodUrl in query string.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                `${baseUrl}/legacy/sanitize/segments?vodUrl=${encodeURIComponent(vodUrl)}&offset=${nextOffset}&limit=${nextLimit}`
            );
            const data: SegmentManifestResponse = await response.json();
            if (!response.ok) {
                throw new Error((data as { detail?: string }).detail || 'Failed to load segments');
            }
            setSegments(data.segments || []);
            setCleanPath(data.cleanPath || null);
            setOriginalPath((data as { originalPath?: string | null }).originalPath || null);
            setTotalSegments(data.total ?? data.segments?.length ?? 0);
            setHasMore(Boolean(data.hasMore));
            setPageOffset(data.offset ?? nextOffset);
            setPageLimit(data.limit ?? nextLimit);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const fetchReview = async (): Promise<void> => {
        if (!vodUrl) return;
        try {
            const response = await fetch(
                `${baseUrl}/legacy/sanitize/review?vodUrl=${encodeURIComponent(vodUrl)}`
            );
            const data: ReviewState = await response.json();
            if (!response.ok) {
                throw new Error((data as { detail?: string }).detail || 'Failed to load review');
            }
            setReviewMeta(data);
            const nextVotes: Record<number, 'accept' | 'reject'> = {};
            const nextNotes: Record<number, string> = {};
            (data.votes || []).forEach((vote: ReviewVote) => {
                nextVotes[vote.index] = vote.decision;
                if (vote.note) {
                    nextNotes[vote.index] = vote.note;
                }
            });
            setVotes(nextVotes);
            setNotes(nextNotes);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleLoad = async (): Promise<void> => {
        await Promise.all([fetchSegments(0, pageLimit), fetchReview()]);
    };

    useEffect(() => {
        if (!vodUrl) return;
        setPageOffset(0);
        setSegments([]);
        handleLoad();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vodUrl]);

    useEffect(() => {
        votesRef.current = votes;
    }, [votes]);


    const summary = useMemo(() => {
        const total = totalSegments || segments.length;
        const accepted = Object.values(votes).filter((v) => v === 'accept').length;
        const rejected = Object.values(votes).filter((v) => v === 'reject').length;
        const remaining = Math.max(0, total - accepted - rejected);
        const percent = total > 0 ? Math.round(((accepted + rejected) / total) * 100) : 0;
        return { total, accepted, rejected, remaining, percent };
    }, [segments, totalSegments, votes]);

    const keptCount = useMemo(
        () => segments.filter((segment) => segment.kept).length,
        [segments]
    );

    const keptRatio = useMemo(() => {
        if (!segments.length) return 0;
        return keptCount / segments.length;
    }, [segments.length, keptCount]);

    const sanitizeSuggestion = useMemo(() => {
        if (!segments.length) return null;
        if (keptCount === 0) {
            return {
                title: 'No segments retained',
                reason: 'Sanitize rejected every segment. Try a safer profile.',
                settings: { mode: 'auto', preset: 'lenient', strictness: 0.4, extractVocals: false },
            } as const;
        }
        if (keptRatio < 0.2) {
            return {
                title: 'Very few segments retained',
                reason: 'Relax the filters to keep more usable speech.',
                settings: { mode: 'auto', preset: 'balanced', strictness: 0.5, extractVocals: false },
            } as const;
        }
        return null;
    }, [segments.length, keptCount, keptRatio]);

    const runSuggestedSanitize = useCallback(async () => {
        if (!sanitizeSuggestion || !vodUrl) return;
        setSuggestionRunning(true);
        setSuggestionMessage(null);
        try {
            const response = await fetch(`${baseUrl}/legacy/sanitize/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vodUrl,
                    mode: sanitizeSuggestion.settings.mode,
                    preset: sanitizeSuggestion.settings.preset,
                    strictness: sanitizeSuggestion.settings.strictness,
                    extractVocals: sanitizeSuggestion.settings.extractVocals,
                    stream: false,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.detail || 'Sanitize failed');
            }
            setSuggestionMessage('Sanitize complete. Reloading segments...');
            await handleLoad();
        } catch (err) {
            setSuggestionMessage((err as Error).message);
        } finally {
            setSuggestionRunning(false);
        }
    }, [baseUrl, handleLoad, sanitizeSuggestion, vodUrl]);

    const acceptedList = useMemo(
        () => segments.filter((segment) => votes[segment.index] === 'accept'),
        [segments, votes]
    );

    const setDecision = useCallback((index: number, decision: 'accept' | 'reject') => {
        const prevDecision = votesRef.current[index] || null;
        setVotes((prev) => ({ ...prev, [index]: decision }));
        setHistory((prev) => [...prev, { index, prevDecision }]);
    }, []);

    // Map SegmentItem to FocusViewSegment for ReviewManager
    const mapToReviewSegment = useCallback((segment: SegmentItem): FocusViewSegment => {
        const cleanAudioUrl = cleanPath ? getArtifactUrl(cleanPath.replace('.wav', `_${segment.index}.wav`)) : undefined;
        const originalAudioUrl = originalPath ? getArtifactUrl(originalPath.replace('.wav', `_${segment.index}.wav`)) : undefined;

        return {
            index: segment.index,
            start: segment.start,
            end: segment.end,
            duration: segment.duration,
            text: `Segment ${segment.index}`,
            confidence: segment.quality ? segment.quality * 10 : undefined,
            snrDb: segment.snrDb ?? undefined,
            speechRatio: segment.speechRatio ? segment.speechRatio * 100 : undefined,
            kept: segment.kept ?? null,
            cleanAudioUrl,
            originalAudioUrl,
            originalSnrDb: undefined,
            originalConfidence: undefined,
            originalSpeechRatio: undefined,
        };
    }, [cleanPath, originalPath, getArtifactUrl]);

    // Handler for segment updates from ReviewManager
    const handleSegmentUpdate = useCallback((index: number, updates: Partial<FocusViewSegment>) => {
        setSegments(prev => prev.map(seg => {
            if (seg.index !== index) return seg;

            const updated: SegmentItem = { ...seg };
            if (updates.kept !== undefined) updated.kept = updates.kept;
            // Note: rejectReason is not part of FocusViewSegment, managed separately

            return updated;
        }));

        // Update votes state
        if (updates.kept === true) {
            setVotes(prev => ({ ...prev, [index]: 'accept' }));
        } else if (updates.kept === false) {
            setVotes(prev => ({ ...prev, [index]: 'reject' }));
        } else if (updates.kept === null) {
            setVotes(prev => {
                const next = { ...prev };
                delete next[index];
                return next;
            });
        }
    }, []);

    // Handler for segment actions from ReviewManager
    const handleSegmentAction = useCallback((index: number, action: 'accept' | 'reject' | 'skip') => {
        if (action === 'accept') {
            setDecision(index, 'accept');
        } else if (action === 'reject') {
            setDecision(index, 'reject');
        }
        // Skip doesn't change state, just navigation
    }, [setDecision]);

    const handleUndo = () => {
        setHistory((prev) => {
            const next = [...prev];
            const last = next.pop();
            if (!last) return prev;
            if (last.prevDecision === 'accept' || last.prevDecision === 'reject') {
                const decision = last.prevDecision;
                setVotes((current) => ({ ...current, [last.index]: decision }));
            } else {
                setVotes((current) => {
                    const updated = { ...current };
                    delete updated[last.index];
                    return updated;
                });
            }
            return next;
        });
    };

    const handleSave = async (): Promise<void> => {
        if (!vodUrl) return;
        setSaving(true);
        setError(null);
        try {
            const voteList: ReviewVote[] = segments
                .filter((segment) => votes[segment.index])
                .map((segment) => ({
                    index: segment.index,
                    decision: votes[segment.index],
                    segment,
                    note: notes[segment.index] || null,
                }));

            const body = {
                vodUrl,
                totalSegments: segments.length,
                reviewIndex: voteList.length,
                votes: voteList,
            };

            const response = await fetch(`${baseUrl}/legacy/sanitize/review`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.detail || 'Failed to save review');
            }
            setReviewMeta(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async (): Promise<void> => {
        if (!vodUrl) return;
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`${baseUrl}/legacy/sanitize/export-clips`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vodUrl }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.detail || 'Export failed');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadReview = () => {
        const payload = {
            vodUrl,
            totalSegments: segments.length,
            votes: segments
                .filter((segment) => votes[segment.index])
                .map((segment) => ({
                    index: segment.index,
                    decision: votes[segment.index],
                    note: notes[segment.index] || null,
                })),
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'review.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    // Adaptive performance mode: auto-enable for large datasets
    useEffect(() => {
        if (totalSegments > 2000 && !perfMode) {
            setPerfMode(true);
        }
    }, [totalSegments, perfMode]);

    return (
        <div className="manual-review-page p-6 grid-bg">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="glass rounded-2xl p-6">
                    <h1 className="text-3xl font-semibold text-white">Manual Review</h1>
                    <p className="text-slate-400 mt-2">
                        Approve or reject sanitized segments. Keyboard: Enter = accept, Space = reject/next, A = prev, D = next.
                    </p>
                </div>

                <div className="glass rounded-2xl p-4 review-toolbar">
                    <div className="review-summary">
                        <div className="text-sm text-slate-300">
                            Total: {summary.total} | Accepted: {summary.accepted} | Rejected: {summary.rejected} | Remaining: {summary.remaining}
                        </div>
                        <div className="text-xs text-slate-500">Reviewed: {summary.percent}%</div>
                        {reviewMeta?.updatedAt && (
                            <div className="text-xs text-slate-500">Last saved: {reviewMeta.updatedAt}</div>
                        )}
                        {totalSegments > 0 && (
                            <div className="text-xs text-slate-500">
                                Showing {pageOffset + 1}-{Math.min(pageOffset + pageLimit, totalSegments)} of {totalSegments}
                            </div>
                        )}
                    </div>
                    <div className="review-actions">
                        <button
                            type="button"
                            onClick={handleLoad}
                            className="primary-btn px-4 py-2 text-sm font-semibold rounded-lg"
                        >
                            Load Latest
                        </button>
                        <button
                            type="button"
                            onClick={() => fetchSegments(Math.max(0, pageOffset - pageLimit), pageLimit)}
                            disabled={pageOffset === 0 || loading}
                            className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            onClick={() => fetchSegments(pageOffset + pageLimit, pageLimit)}
                            disabled={!hasMore || loading}
                            className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                        >
                            Load more
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || segments.length === 0}
                            className="primary-btn px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60"
                        >
                            {saving ? 'Saving...' : 'Save Review'}
                        </button>
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={saving || acceptedList.length === 0}
                            className="secondary-btn px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                        >
                            Export Accepted
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadReview}
                            className="secondary-btn px-4 py-2 text-xs font-semibold rounded-lg"
                        >
                            Download JSON
                        </button>
                        <button
                            type="button"
                            onClick={handleUndo}
                            disabled={history.length === 0}
                            className="secondary-btn px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                        >
                            Undo
                        </button>
                    </div>
                </div>

                <div className="glass rounded-2xl p-3 review-toolbar">
                    <div className="review-actions">
                        <button
                            type="button"
                            onClick={() => setShowTimeline((prev) => !prev)}
                            className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
                        >
                            {showTimeline ? 'Hide timeline' : 'Show timeline'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowTrays((prev) => !prev)}
                            className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
                        >
                            {showTrays ? 'Hide trays' : 'Show trays'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setPerfMode((prev) => !prev)}
                            className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
                        >
                            {perfMode ? 'Performance mode: ON' : 'Performance mode: OFF'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-sm text-rose-200">
                        {error}
                    </div>
                )}

                {sanitizeSuggestion && (
                    <div className="glass rounded-2xl p-4 review-suggest">
                        <div className="review-section-header">
                            <h3 className="text-sm font-semibold text-white">{sanitizeSuggestion.title}</h3>
                            <span className="text-xs text-slate-500">Suggestion</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            {sanitizeSuggestion.reason}
                        </p>
                        <div className="text-xs text-slate-500 mt-2">
                            Proposed: {sanitizeSuggestion.settings.preset}, strictness {sanitizeSuggestion.settings.strictness},
                            UVR {sanitizeSuggestion.settings.extractVocals ? 'ON' : 'OFF'}
                        </div>
                        <div className="review-actions mt-3">
                            <button
                                type="button"
                                onClick={runSuggestedSanitize}
                                disabled={suggestionRunning}
                                className="primary-btn px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                            >
                                {suggestionRunning ? 'Running sanitize...' : 'Run suggested sanitize'}
                            </button>
                            {suggestionMessage && (
                                <span className="text-xs text-slate-400">{suggestionMessage}</span>
                            )}
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="text-sm text-slate-400">Loading segments...</div>
                ) : segments.length === 0 ? (
                    <div className="glass rounded-2xl p-4 text-sm text-slate-400">
                        No segments loaded yet. Run Sanitize in the wizard, then click Load Latest.
                    </div>
                ) : (
                    <div className="review-layout">
                        {/* New Review System */}
                        <ReviewManager
                            segments={segments.map(mapToReviewSegment)}
                            onSegmentUpdate={handleSegmentUpdate}
                            onSegmentAction={handleSegmentAction}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export const ManualReviewPage: React.FC<ManualReviewPageProps> = ({ vodUrlOverride }) => {
    const [searchParams] = useSearchParams();
    const vodUrl = vodUrlOverride || searchParams.get('vodUrl') || '';
    return <ManualReviewPanel vodUrl={vodUrl} />;
};
