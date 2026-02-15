/**
 * Manual Review Page
 * Rich approve/reject view for sanitized segments.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { config } from '../../../config';
import { ReviewManager, FocusViewSegment } from '../../components/review';
import '../../components/review/review-views.css';

type SegmentItem = {
    index: number;
    start: number;
    end: number;
    duration: number;
    cleanStart?: number | null;
    cleanEnd?: number | null;
    kept?: boolean | null;
    text?: string | null;
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
    runIdOverride?: string;
};

type HistoryEntry = {
    index: number;
    prevDecision: 'accept' | 'reject' | null;
};

const ManualReviewPanel: React.FC<{ vodUrl: string; runId?: string }> = ({ vodUrl, runId }) => {

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
    const [autoReviewRunning, setAutoReviewRunning] = useState(false);
    const [autoReviewMessage, setAutoReviewMessage] = useState<string | null>(null);
    const [autoReviewProgress, setAutoReviewProgress] = useState(0);
    const [autoReviewProgressText, setAutoReviewProgressText] = useState('');

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
        if (!runId) {
            setError('runId is required for manual review. Open review from Wizard job context.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                `${baseUrl}/legacy/sanitize/segments?vodUrl=${encodeURIComponent(vodUrl)}&offset=${nextOffset}&limit=${nextLimit}${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`
            );
            const data: SegmentManifestResponse = await response.json();
            if (!response.ok) {
                throw new Error((data as { detail?: string }).detail || 'Failed to load segments');
            }
            setSegments(data.segments || []);
            setCleanPath(data.cleanPath || null);
            setOriginalPath((data as { originalPath?: string | null }).originalPath || null);
            setTotalSegments(data.total ?? data.segments?.length ?? 0);
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
        if (!runId) return;
        try {
            const response = await fetch(
                `${baseUrl}/legacy/sanitize/review?vodUrl=${encodeURIComponent(vodUrl)}${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`
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
        if (!runId) {
            setError('runId is required for manual review.');
            return;
        }
        await Promise.all([fetchSegments(0, pageLimit), fetchReview()]);
    };

    useEffect(() => {
        if (!vodUrl) return;
        setPageOffset(0);
        setSegments([]);
        handleLoad();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vodUrl, runId]);

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

    const totalPages = useMemo(() => {
        const total = Math.max(0, totalSegments || segments.length);
        return Math.max(1, Math.ceil(total / Math.max(1, pageLimit)));
    }, [pageLimit, segments.length, totalSegments]);

    const currentPage = useMemo(
        () => Math.min(totalPages, Math.max(1, Math.floor(pageOffset / Math.max(1, pageLimit)) + 1)),
        [pageLimit, pageOffset, totalPages]
    );

    const paginationPages = useMemo(() => {
        const radius = 2;
        const start = Math.max(1, currentPage - radius);
        const end = Math.min(totalPages, currentPage + radius);
        const pages: number[] = [];
        for (let page = start; page <= end; page += 1) {
            pages.push(page);
        }
        return pages;
    }, [currentPage, totalPages]);

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
                    runId: runId || undefined,
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
    }, [baseUrl, handleLoad, runId, sanitizeSuggestion, vodUrl]);

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
        const cleanAudioUrl = cleanPath ? getArtifactUrl(cleanPath) : undefined;
        const originalAudioUrl = originalPath ? getArtifactUrl(originalPath) : undefined;

        return {
            index: segment.index,
            start: segment.start,
            end: segment.end,
            duration: segment.duration,
            cleanStart: segment.cleanStart ?? null,
            cleanEnd: segment.cleanEnd ?? null,
            text: segment.text || `Segment ${segment.index}`,
            confidence: segment.quality ?? undefined,
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
                runId: runId || undefined,
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

    const handleAutomaticReview = useCallback(async (): Promise<void> => {
        if (!vodUrl || !segments.length) return;

        setAutoReviewRunning(true);
        setAutoReviewMessage(null);
        setAutoReviewProgress(0);
        setAutoReviewProgressText('Loading all segments...');
        setError(null);

        try {
            const allSegments: SegmentItem[] = [];
            const chunkSize = 500;
            let offset = 0;
            let expectedTotal = totalSegments || segments.length;

            while (true) {
                const response = await fetch(
                    `${baseUrl}/legacy/sanitize/segments?vodUrl=${encodeURIComponent(vodUrl)}&offset=${offset}&limit=${chunkSize}${runId ? `&runId=${encodeURIComponent(runId)}` : ''}`
                );
                const payload: SegmentManifestResponse = await response.json();
                if (!response.ok) {
                    throw new Error((payload as { detail?: string }).detail || 'Failed to load segments for automatic review');
                }

                const batch = payload.segments || [];
                expectedTotal = payload.total ?? expectedTotal;
                allSegments.push(...batch);

                const loaded = allSegments.length;
                const ratio = expectedTotal > 0 ? Math.min(100, Math.round((loaded / expectedTotal) * 100)) : 0;
                setAutoReviewProgress(Math.max(5, ratio));
                setAutoReviewProgressText(`Analyzing segments ${loaded}/${expectedTotal}...`);

                if (!payload.hasMore || batch.length === 0) {
                    break;
                }
                offset += chunkSize;
            }

            const nextVotes: Record<number, 'accept' | 'reject'> = {};
            const confidenceThreshold = 85;
            const speechThreshold = 85;

            for (const segment of allSegments) {
                const confidence = Number(segment.quality ?? 0);
                const rawSpeech = Number(segment.speechRatio ?? 0);
                const speechPercent = rawSpeech <= 1 ? rawSpeech * 100 : rawSpeech;
                nextVotes[segment.index] =
                    confidence >= confidenceThreshold && speechPercent >= speechThreshold
                        ? 'accept'
                        : 'reject';
            }

            setAutoReviewProgress(92);
            setAutoReviewProgressText('Saving automatic review...');

            setVotes(nextVotes);
            setSegments((prev) =>
                prev.map((segment) => ({
                    ...segment,
                    kept: nextVotes[segment.index] === 'accept',
                }))
            );

            const voteList: ReviewVote[] = allSegments.map((segment) => ({
                index: segment.index,
                decision: nextVotes[segment.index],
                segment: {
                    ...segment,
                    kept: nextVotes[segment.index] === 'accept',
                },
                note: notes[segment.index] || null,
            }));

            const body = {
                vodUrl,
                runId: runId || undefined,
                totalSegments: allSegments.length,
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
                throw new Error(data?.detail || 'Automatic review save failed');
            }

            setReviewMeta(data);
            const accepted = Object.values(nextVotes).filter((vote) => vote === 'accept').length;
            const rejected = Object.values(nextVotes).filter((vote) => vote === 'reject').length;
            setAutoReviewMessage(`Automatic review saved: accepted ${accepted}, rejected ${rejected}`);
            setAutoReviewProgress(100);
            setAutoReviewProgressText('Automatic review completed');
        } catch (err) {
            setError((err as Error).message);
            setAutoReviewMessage((err as Error).message);
            setAutoReviewProgressText('Automatic review failed');
        } finally {
            setAutoReviewRunning(false);
        }
    }, [baseUrl, notes, runId, segments.length, totalSegments, vodUrl]);

    const handleExport = async (): Promise<void> => {
        if (!vodUrl) return;
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`${baseUrl}/legacy/sanitize/export-clips`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vodUrl, runId: runId || undefined }),
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
                            onClick={handleSave}
                            disabled={saving || segments.length === 0}
                            className="primary-btn px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-60"
                        >
                            {saving ? 'Saving...' : 'Save Review'}
                        </button>
                        <button
                            type="button"
                            onClick={handleAutomaticReview}
                            disabled={autoReviewRunning || saving || segments.length === 0}
                            className="secondary-btn px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                            title="Apply intelligent accept/reject decisions and save review automatically"
                        >
                            {autoReviewRunning ? 'Auto reviewing...' : 'Automatic Review'}
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
                    {autoReviewMessage && (
                        <div className="text-xs text-slate-400 mt-2">{autoReviewMessage}</div>
                    )}
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
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => fetchSegments(0, pageLimit)}
                                disabled={currentPage <= 1 || loading}
                                className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                            >
                                First
                            </button>
                            <button
                                type="button"
                                onClick={() => fetchSegments(Math.max(0, pageOffset - pageLimit), pageLimit)}
                                disabled={currentPage <= 1 || loading}
                                className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                            >
                                Previous
                            </button>
                            <div className="flex items-center gap-1">
                                {paginationPages[0] > 1 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => fetchSegments(0, pageLimit)}
                                            disabled={loading}
                                            className="secondary-btn px-2 py-1 text-xs font-semibold rounded disabled:opacity-60"
                                        >
                                            1
                                        </button>
                                        {paginationPages[0] > 2 && <span className="text-xs text-slate-500">…</span>}
                                    </>
                                )}
                                {paginationPages.map((page) => (
                                    <button
                                        key={page}
                                        type="button"
                                        onClick={() => fetchSegments((page - 1) * pageLimit, pageLimit)}
                                        disabled={loading}
                                        className={`px-2 py-1 text-xs font-semibold rounded border ${page === currentPage
                                                ? 'border-cyan-300/70 bg-cyan-300/20 text-cyan-100'
                                                : 'border-white/20 text-slate-200 hover:bg-white/10'
                                            } disabled:opacity-60`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                {paginationPages[paginationPages.length - 1] < totalPages && (
                                    <>
                                        {paginationPages[paginationPages.length - 1] < totalPages - 1 && (
                                            <span className="text-xs text-slate-500">…</span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => fetchSegments((totalPages - 1) * pageLimit, pageLimit)}
                                            disabled={loading}
                                            className="secondary-btn px-2 py-1 text-xs font-semibold rounded disabled:opacity-60"
                                        >
                                            {totalPages}
                                        </button>
                                    </>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => fetchSegments(pageOffset + pageLimit, pageLimit)}
                                disabled={currentPage >= totalPages || loading}
                                className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                            >
                                Next
                            </button>
                            <button
                                type="button"
                                onClick={() => fetchSegments((totalPages - 1) * pageLimit, pageLimit)}
                                disabled={currentPage >= totalPages || loading}
                                className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                            >
                                Last
                            </button>
                            <label className="text-xs text-slate-400 flex items-center gap-2">
                                Per page
                                <select
                                    value={pageLimit}
                                    onChange={(event) => {
                                        const nextLimit = Number(event.target.value) || 200;
                                        setPageLimit(nextLimit);
                                        void fetchSegments(0, nextLimit);
                                    }}
                                    className="rounded border border-white/20 bg-slate-900/60 px-2 py-1 text-xs text-slate-100"
                                >
                                    <option value={100}>100</option>
                                    <option value={200}>200</option>
                                    <option value={500}>500</option>
                                </select>
                            </label>
                            <span className="text-xs text-slate-500">Page {currentPage}/{totalPages}</span>
                        </div>

                        <div className="review-layout">
                            {/* New Review System */}
                            <ReviewManager
                                segments={segments.map(mapToReviewSegment)}
                                onSegmentUpdate={handleSegmentUpdate}
                                onSegmentAction={handleSegmentAction}
                            />
                        </div>
                    </div>
                )}
            </div>

            {autoReviewRunning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-950 p-5 shadow-2xl">
                        <h3 className="text-base font-semibold text-white">Automatic Review in progress</h3>
                        <p className="mt-2 text-sm text-slate-300">{autoReviewProgressText || 'Processing...'}</p>
                        <div className="mt-4 h-2 w-full overflow-hidden rounded bg-white/10">
                            <div
                                className="h-full rounded bg-cyan-400 transition-all duration-300"
                                style={{ width: `${Math.max(0, Math.min(100, autoReviewProgress))}%` }}
                            />
                        </div>
                        <p className="mt-2 text-right text-xs text-slate-400">{autoReviewProgress}%</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export const ManualReviewPage: React.FC<ManualReviewPageProps> = ({ vodUrlOverride, runIdOverride }) => {
    const [searchParams] = useSearchParams();
    const vodUrl = vodUrlOverride || searchParams.get('vodUrl') || '';
    const runId = runIdOverride || searchParams.get('runId') || undefined;
    return <ManualReviewPanel vodUrl={vodUrl} runId={runId} />;
};
