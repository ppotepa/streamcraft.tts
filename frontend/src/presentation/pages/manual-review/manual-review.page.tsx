/**
                        {loading ? (
                            <div className="text-sm text-slate-400">Loading segments...</div>
                        ) : segments.length === 0 ? (
                            <div className="glass rounded-2xl p-4 text-sm text-slate-400">
                                No segments loaded yet. Run Sanitize in the wizard, then click Load Latest.
                            </div>
                        ) : (
                            <div className="glass rounded-2xl p-4">
                                <ReviewManager
                                    segments={segments.map(mapToReviewSegment)}
                                    onSegmentUpdate={handleSegmentUpdate}
                                    onSegmentAction={handleSegmentAction}
                                />
                            </div>
                        )}
            };
        });
    }, [segments, totalDuration, votes, showTimeline, perfMode]);

    const deferredFilterMode = useDeferredValue(filterMode);
    const deferredSortMode = useDeferredValue(sortMode);

    const filteredInbox = useMemo(() => {
        const list = segments.filter((segment) => !votes[segment.index]);
        const filtered = list.filter((segment) => {
            if (deferredFilterMode === 'low-snr') return (segment.snrDb ?? 99) < 8;
            if (deferredFilterMode === 'low-speech') return (segment.speechRatio ?? 1) < 0.5;
            if (deferredFilterMode === 'short') return segment.duration < 1.0;
            if (deferredFilterMode === 'labeled') return segment.labels.length > 0 || segment.rejectReason.length > 0;
            return true;
        });

        const sorted = [...filtered].sort((a, b) => {
            if (deferredSortMode === 'duration') return a.duration - b.duration;
            if (deferredSortMode === 'snr') return (a.snrDb ?? 99) - (b.snrDb ?? 99);
            if (deferredSortMode === 'speech') return (a.speechRatio ?? 1) - (b.speechRatio ?? 1);
            return a.start - b.start;
        });

        return sorted;
    }, [segments, votes, deferredFilterMode, deferredSortMode]);

    const acceptedList = useMemo(
        () => segments.filter((segment) => votes[segment.index] === 'accept'),
        [segments, votes]
    );

    const rejectedList = useMemo(
        () => segments.filter((segment) => votes[segment.index] === 'reject'),
        [segments, votes]
    );

    useEffect(() => {
        if (filteredInbox.length === 0) {
            setActiveId(null);
            return;
        }
        if (activeId && filteredInbox.some((segment) => segment.index === activeId)) {
            return;
        }
        setActiveId(filteredInbox[0].index);
    }, [filteredInbox, activeId]);

    const activeSegment = useMemo(
        () => filteredInbox.find((segment) => segment.index === activeId) || null,
        [filteredInbox, activeId]
    );

    const itemHeight = useMemo(() => {
        if (perfMode) return 130;
        if (compactMode) return 150;
        return 210;
    }, [compactMode, perfMode]);

    const totalItems = filteredInbox.length;
    const overscan = 6;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        totalItems,
        Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
    );
    const visibleItems = filteredInbox.slice(startIndex, endIndex);
    const topSpacer = startIndex * itemHeight;
    const bottomSpacer = Math.max(0, (totalItems - endIndex) * itemHeight);

    useEffect(() => {
        const list = listRef.current;
        if (!list) return;

        const updateHeight = () => setViewportHeight(list.clientHeight || 520);
        updateHeight();

        const onResize = () => updateHeight();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const handleListScroll = useCallback(() => {
        const list = listRef.current;
        if (!list) return;
        if (scrollRafRef.current) return;
        scrollRafRef.current = window.requestAnimationFrame(() => {
            scrollRafRef.current = null;
            setScrollTop(list.scrollTop);
        });
    }, []);

    const setDecision = useCallback((index: number, decision: 'accept' | 'reject') => {
        const prevDecision = votesRef.current[index] || null;
        setVotes((prev) => ({ ...prev, [index]: decision }));
        setHistory((prev) => [...prev, { index, prevDecision }]);
        setSelected((prev) => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
    }, []);

    const restoreDecision = useCallback((index: number) => {
        setVotes((prev) => {
            const next = { ...prev };
            delete next[index];
            return next;
        });
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
            text: `Segment ${segment.index}`, // Could be transcription text if available
            confidence: segment.quality ? segment.quality * 10 : undefined,
            snrDb: segment.snrDb ?? undefined,
            speechRatio: segment.speechRatio ? segment.speechRatio * 100 : undefined,
            kept: segment.kept ?? null,
            rejectReason: segment.rejectReason,
            cleanAudioUrl,
            originalAudioUrl,
            // Original metrics would be stored separately if available
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
            if (updates.text !== undefined) {
                // Text updates would be saved as notes or transcript edits
            }
            if (updates.rejectReason !== undefined) updated.rejectReason = updates.rejectReason;

            return updated;
        }));

        // Update votes state
        if (updates.kept === true) {
            setVotes(prev => ({ ...prev, [index]: 'accept' }));
        } else if (updates.kept === false) {
            setVotes(prev => ({ ...prev, [index]: 'reject' }));
        } else if (updates.kept === null) {
            // Remove vote
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

    const moveNext = useCallback(() => {
        if (!activeSegment) return;
        const idx = filteredInbox.findIndex((segment) => segment.index === activeSegment.index);
        const next = filteredInbox[idx + 1] || filteredInbox[idx - 1];
        setActiveId(next ? next.index : null);
    }, [activeSegment, filteredInbox]);

    const movePrev = useCallback(() => {
        if (!activeSegment) return;
        const idx = filteredInbox.findIndex((segment) => segment.index === activeSegment.index);
        const prev = filteredInbox[idx - 1] || filteredInbox[idx + 1];
        setActiveId(prev ? prev.index : null);
    }, [activeSegment, filteredInbox]);

    const acceptActive = useCallback(() => {
        if (!activeSegment) return;
        setDecision(activeSegment.index, 'accept');
    }, [activeSegment, setDecision]);

    const rejectActive = useCallback(() => {
        if (!activeSegment) return;
        setDecision(activeSegment.index, 'reject');
    }, [activeSegment, setDecision]);

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

    const handleBatchDecision = (decision: 'accept' | 'reject') => {
        const ids = Object.keys(selected).map((id) => Number(id));
        if (ids.length === 0) return;
        setVotes((prev) => {
            const next = { ...prev };
            ids.forEach((id) => {
                next[id] = decision;
            });
            return next;
        });
        setHistory((prev) => [
            ...prev,
            ...ids.map((id) => ({ index: id, prevDecision: votesRef.current[id] || null })),
        ]);
        setSelected({});
    };

    const handleAutoReject = () => {
        const ids = filteredInbox
            .filter((segment) =>
                (segment.snrDb ?? 99) < autoRejectSnr ||
                (segment.speechRatio ?? 1) < autoRejectSpeech ||
                segment.duration < autoRejectDuration
            )
            .map((segment) => segment.index);
        if (ids.length === 0) return;
        setVotes((prev) => {
            const next = { ...prev };
            ids.forEach((id) => {
                next[id] = 'reject';
            });
            return next;
        });
        setHistory((prev) => [
            ...prev,
            ...ids.map((id) => ({ index: id, prevDecision: votesRef.current[id] || null })),
        ]);
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

    const playSegment = (segment: SegmentItem) => {
        const audio = audioRef.current;
        if (!audio || !audioSrc) return;
        const bounds = getSegmentBounds(segment, playbackSource);
        const start = bounds.start;
        const end = bounds.end;

        playbackEndRef.current = end;
        const beginPlayback = () => {
            audio.currentTime = start;
            audio.play().catch((err) => {
                // Ignore AbortError from rapid play/pause cycles
                if (err.name !== 'AbortError') {
                    console.error('Playback error:', err);
                }
            });
            setPlayingId(segment.index);
        };

        if (Number.isFinite(audio.duration) && audio.readyState >= 1) {
            beginPlayback();
            return;
        }

        const handleReady = () => {
            audio.removeEventListener('loadedmetadata', handleReady);
            beginPlayback();
        };

        audio.addEventListener('loadedmetadata', handleReady);
        audio.load();
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const onTimeUpdate = () => {
            setPlayhead(audio.currentTime);
            if (playbackEndRef.current !== null && audio.currentTime >= playbackEndRef.current) {
                audio.pause();
                playbackEndRef.current = null;
                setPlayingId(null);
            }
        };
        const onEnded = () => setPlayingId(null);
        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);
        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    useEffect(() => {
        if (!activeSegment) return;
        const audio = audioRef.current;
        if (!audio) return;
        const bounds = getSegmentBounds(activeSegment, playbackSource);
        audio.currentTime = bounds.start;
        setPlayhead(bounds.start);
        setPlayingId(null);
    }, [activeSegment, getSegmentBounds, playbackSource]);

    const audioSrc = useMemo(() => {
        if (playbackSource === 'original' && originalPath) {
            return getArtifactUrl(originalPath);
        }
        return cleanPath ? getArtifactUrl(cleanPath) : '';
    }, [playbackSource, originalPath, cleanPath, getArtifactUrl]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        setPlayingId(null);
        playbackEndRef.current = null;
        audio.load();
        if (pendingPlayRef.current && activeSegment) {
            const pending = pendingPlayRef.current;
            pendingPlayRef.current = null;
            const target = pendingSegmentRef.current ?? activeSegment;
            pendingSegmentRef.current = null;
            if (pending === playbackSource) {
                playSegment(target);
                // Fetch transcription when starting clean playback
                if (pending === 'clean') {
                    console.log('[Transcription] Triggering fetch from useEffect for segment', target.index);
                    fetchSegmentTranscription(target.index);
                }
            }
        }
    }, [audioSrc, activeSegment, playbackSource, fetchSegmentTranscription]);

    useEffect(() => {
        if (!activeSegment) return;
        if (playbackSource === 'clean' && !cleanOffsets.has(activeSegment.index) && originalPath) {
            setPlaybackSource('original');
        }
    }, [activeSegment, cleanOffsets, playbackSource, originalPath]);

    // Adaptive performance mode: auto-enable for large datasets
    useEffect(() => {
        if (totalSegments > 2000 && !perfMode) {
            setPerfMode(true);
            setPlaybackMessage('Performance mode auto-enabled for large dataset (>2000 segments)');
            setTimeout(() => setPlaybackMessage(null), 5000);
        }
    }, [totalSegments, perfMode]);

    // Track current word based on playback position for live transcript highlighting
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !activeSegment || transcriptWords.length === 0) {
            setCurrentWordIndex(-1);
            return;
        }

        const onTimeUpdate = () => {
            if (playingId !== activeSegment.index || playbackSource !== 'clean') {
                setCurrentWordIndex(-1);
                return;
            }

            const bounds = getSegmentBounds(activeSegment, 'clean');
            const relativeTime = audio.currentTime - bounds.start;

            // Find the word at current playback position
            let foundIndex = -1;
            for (let i = 0; i < transcriptWords.length; i++) {
                const word = transcriptWords[i];
                if (relativeTime >= word.start && relativeTime < word.end) {
                    foundIndex = i;
                    break;
                }
                if (relativeTime >= word.start) {
                    foundIndex = i; // Last word that has started
                }
            }

            setCurrentWordIndex(foundIndex);
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        return () => audio.removeEventListener('timeupdate', onTimeUpdate);
    }, [activeSegment, transcriptWords, playingId, playbackSource, getSegmentBounds]);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio || !activeSegment || !audioSrc) return;
        if (audio.paused) {
            playSegment(activeSegment);
            return;
        }
        audio.pause();
        playbackEndRef.current = null;
        setPlayingId(null);
    };

    const playClean = (segment?: SegmentItem | null) => {
        const target = segment ?? activeSegment;
        if (!target) return;

        // Intelligent fallback: if clean audio unavailable, play original with notification
        if (!cleanOffsets.has(target.index)) {
            if (!originalPath) return;
            setPlaybackMessage('Clean audio unavailable (segment rejected) - playing original');
            setTimeout(() => setPlaybackMessage(null), 3000);
            // Let playOriginal handle transcription to avoid double-fetch
            console.log('[Transcription] Fallback to playOriginal for segment', target.index);
            playOriginal(target);
            return;
        }

        if (playbackSource === 'clean') {
            playSegment(target);
            // Fetch transcription when playing clean segment
            console.log('[Transcription] Triggering fetch from playClean for segment', target.index);
            fetchSegmentTranscription(target.index);
            return;
        }
        pendingPlayRef.current = 'clean';
        pendingSegmentRef.current = target;
        setPlaybackSource('clean');
        console.log('[Transcription] Switching to clean source, will fetch after load');
        // Transcription will be fetched after playback source switch completes
    };

    const playOriginal = (segment?: SegmentItem | null) => {
        const target = segment ?? activeSegment;
        if (!target || !originalPath) return;
        if (playbackSource === 'original') {
            playSegment(target);
            // Fetch transcription when already on original source
            console.log('[Transcription] Triggering fetch from playOriginal for segment', target.index);
            fetchSegmentTranscription(target.index);
            return;
        }
        pendingPlayRef.current = 'original';
        pendingSegmentRef.current = target;
        setPlaybackSource('original');
        // Transcription will be fetched after playback source switch completes
    };

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                acceptActive();
            }
            if (event.key === ' ') {
                event.preventDefault();
                rejectActive();
            }
            if (event.key.toLowerCase() === 'a') {
                event.preventDefault();
                movePrev();
            }
            if (event.key.toLowerCase() === 'd') {
                event.preventDefault();
                moveNext();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [acceptActive, rejectActive, movePrev, moveNext]);

    const scrubValue = useMemo(() => {
        if (!activeSegment) return 0;
        const bounds = getSegmentBounds(activeSegment, playbackSource);
        const duration = Math.max(0.01, bounds.end - bounds.start);
        return Math.min(100, Math.max(0, ((playhead - bounds.start) / duration) * 100));
    }, [activeSegment, getSegmentBounds, playhead, playbackSource]);

    const handleScrub = (value: number) => {
        if (!activeSegment) return;
        const audio = audioRef.current;
        if (!audio) return;
        const bounds = getSegmentBounds(activeSegment, playbackSource);
        const duration = Math.max(0.01, bounds.end - bounds.start);
        audio.currentTime = bounds.start + (value / 100) * duration;
        setPlayhead(audio.currentTime);
    };

    const badgeClass = (value: number | null | undefined, good: number, warn: number) => {
        if (value === null || value === undefined) return 'badge badge-muted';
        if (value >= good) return 'badge badge-good';
        if (value >= warn) return 'badge badge-warn';
        return 'badge badge-bad';
    };

    const handleRunSelect = useCallback((run: VodRun) => {
        console.log('[RunSelector] Selected run:', run.run_id);
        // Reload segments for the selected run
        // This would require backend support for loading specific run segments
        // For now, just log it
    }, []);

    const handleSegmentClick = useCallback((segmentIndex: number) => {
        setActiveId(segmentIndex);
        const segment = segments.find(s => s.index === segmentIndex);
        if (segment) {
            playClean(segment);
        }
    }, [segments]);

    return (
        <div className="manual-review-page p-6 grid-bg">
            <div className="max-w-full mx-auto">
                <div className="glass rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-semibold text-white">Manual Review</h1>
                            <p className="text-slate-400 mt-2">
                                Approve or reject sanitized segments. Keyboard: Enter = accept, Space = reject/next, A = prev, D = next.
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {vodUrl && (
                                <RunSelector
                                    vodUrl={vodUrl}
                                    onRunSelect={handleRunSelect}
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => setShowChatFeed(!showChatFeed)}
                                className="secondary-btn px-4 py-2 text-sm font-semibold rounded-lg"
                            >
                                {showChatFeed ? 'Hide Chat' : 'Show Chat'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-6">
                    {/* Main content area */}
<div className={`space-y-6 ${showChatFeed ? 'flex-[3]' : 'max-w-6xl mx-auto'}`}>

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
                onClick={() => setShowWaveform((prev) => !prev)}
                className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
            >
                {showWaveform ? 'Hide Waveform' : 'Show Waveform'}
            </button>
            <button
                type="button"
                onClick={() => setShowTimeline((prev) => !prev)}
                className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
            >
                {showTimeline ? 'Hide timeline' : 'Show timeline'}
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

    {playbackMessage && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-sm text-amber-200">
            {playbackMessage}
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

    {/* Waveform visualization */}
    {showWaveform && (cleanPath || originalPath) && (
        <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-semibold text-white mb-1">Audio Waveform</h3>
                    <p className="text-xs text-slate-400">Click segments to navigate</p>
                </div>
                <div className="flex gap-2">
                    <button
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${waveformSource === 'clean'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                        onClick={() => setWaveformSource('clean')}
                        disabled={!cleanPath}
                    >
                        Clean
                    </button>
                    <button
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${waveformSource === 'original'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                        onClick={() => setWaveformSource('original')}
                        disabled={!originalPath}
                    >
                        Original
                    </button>
                </div>
            </div>
            <Waveform
                audioUrl={getArtifactUrl(waveformSource === 'clean' ? cleanPath || '' : originalPath || '')}
                segments={waveformSegments}
                activeSegment={activeId}
                onSegmentClick={(index) => {
                    const segment = segments.find(s => s.index === index);
                    if (segment) {
                        setActiveId(index);
                        playClean(segment);
                    }
                }}
                height={120}
            />
        </div>
    )}

    {segments.length > 0 && totalDuration > 0 && showTimeline && !perfMode && (
        <div className="glass rounded-2xl p-4 review-timeline">
            <div className="review-section-header">
                <h3 className="text-sm font-semibold text-white">Timeline</h3>
                <span className="text-xs text-slate-500">{formatTime(totalDuration)} total</span>
            </div>
            <div className="review-timeline-track">
                {timelineSegments.map((item) => (
                    <button
                        key={`timeline-${item.index}`}
                        type="button"
                        className={`review-timeline-item ${item.decision}`}
                        style={{ left: `${item.left}%`, width: `${item.width}%` }}
                        onClick={() => setActiveId(item.index)}
                        aria-label={`Segment ${item.index}`}
                    />
                ))}
                {activeSegment && (
                    <div
                        className="review-timeline-cursor"
                        style={{ left: `${(activeSegment.start / totalDuration) * 100}%` }}
                    />
                )}
            </div>
        </div>
    )}

    <div className="glass rounded-2xl p-4 review-player">
        <div className="review-player-header">
            <div>
                <h2 className="text-lg font-semibold text-white">Segment Player</h2>
                <p className="text-xs text-slate-400">
                    {activeSegment
                        ? `#${activeSegment.index} ${formatTime(activeSegment.start)} - ${formatTime(activeSegment.end)}`
                        : 'Select a segment to preview'}
                </p>
            </div>
            <div className="review-player-controls">
                <label className="review-toggle">
                    <input
                        type="checkbox"
                        checked={compactMode}
                        onChange={(event) => setCompactMode(event.target.checked)}
                    />
                    Compact
                </label>
            </div>
        </div>

        <div className="review-player-body">
            <div className="review-player-main">
                <div className="review-player-buttons">
                    <button
                        type="button"
                        onClick={() => playClean()}
                        disabled={!activeSegment || (!cleanPath && !originalPath)}
                        className="primary-btn px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                        title={activeSegment && !cleanOffsets.has(activeSegment.index) ? 'Clean audio unavailable - will play original' : 'Play segment audio'}
                    >
                        {playingId === activeSegment?.index && playbackSource === 'clean'
                            ? 'PLAYING SEGMENT...'
                            : activeSegment && !cleanOffsets.has(activeSegment.index)
                                ? 'PLAY SEGMENT (→original)'
                                : 'PLAY SEGMENT'}
                    </button>
                    <button
                        type="button"
                        onClick={() => playOriginal()}
                        disabled={!activeSegment || !originalPath}
                        className="secondary-btn review-original-btn px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                    >
                        {playingId === activeSegment?.index && playbackSource === 'original'
                            ? 'PLAYING ORIGINAL...'
                            : 'PLAY ORIGINAL'}
                    </button>
                    <button
                        type="button"
                        onClick={acceptActive}
                        disabled={!activeSegment}
                        className="secondary-btn px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                    >
                        Accept
                    </button>
                    <button
                        type="button"
                        onClick={rejectActive}
                        disabled={!activeSegment}
                        className="secondary-btn px-4 py-2 text-xs font-semibold rounded-lg disabled:opacity-60"
                    >
                        Reject
                    </button>
                </div>
                <div className="review-scrub">
                    <div className="review-scrub-labels">
                        <span>{activeSegment ? formatTime(activeSegment.start) : '--'}</span>
                        <span>{activeSegment ? formatTime(activeSegment.end) : '--'}</span>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={scrubValue}
                        onChange={(event) => handleScrub(Number(event.target.value))}
                        disabled={!activeSegment || !cleanPath}
                    />
                </div>
                <audio ref={audioRef} className="audio-player" controls preload="metadata">
                    {audioSrc && <source src={audioSrc} type="audio/wav" />}
                </audio>
            </div>
            <div className="review-player-settings">
                <div className="review-field">
                    <label className="text-xs text-slate-400">Note</label>
                    <textarea
                        rows={2}
                        value={activeSegment ? notes[activeSegment.index] || '' : ''}
                        onChange={(event) =>
                            activeSegment &&
                            setNotes((prev) => ({ ...prev, [activeSegment.index]: event.target.value }))
                        }
                        className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs text-white"
                    />
                </div>
                <div className="review-field mt-3">
                    <label className="text-xs text-slate-400 flex items-center justify-between">
                        <span>Live Transcript (SRT)</span>
                        {transcribing && <span className="text-amber-400 animate-pulse">Transcribing...</span>}
                    </label>
                    <div className="mt-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white min-h-[60px] max-h-[120px] overflow-y-auto">
                        {transcriptWords.length > 0 ? (
                            <div className="leading-relaxed">
                                {transcriptWords.map((word, idx) => (
                                    <span
                                        key={idx}
                                        className={idx === currentWordIndex ? 'text-amber-300 font-bold bg-amber-500/20 px-0.5 rounded' : 'text-slate-300'}
                                    >
                                        {word.word}{' '}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="text-slate-500 italic">
                                {transcribing ? 'Waiting for transcription...' : 'Play segment to see live transcription'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div className="glass rounded-2xl p-4 review-toolbar">
        <div className="review-filters">
            <div className="review-field">
                <label className="text-xs text-slate-400">Filter</label>
                <select
                    value={filterMode}
                    onChange={(event) => setFilterMode(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs text-white"
                >
                    <option value="all">All</option>
                    <option value="low-snr">Low SNR</option>
                    <option value="low-speech">Low speech ratio</option>
                    <option value="short">Short clips</option>
                    <option value="labeled">Labeled</option>
                </select>
            </div>
            <div className="review-field">
                <label className="text-xs text-slate-400">Sort</label>
                <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs text-white"
                >
                    <option value="start">Start time</option>
                    <option value="duration">Duration</option>
                    <option value="snr">SNR</option>
                    <option value="speech">Speech ratio</option>
                </select>
            </div>
            <div className="review-field">
                <label className="text-xs text-slate-400">Auto-reject SNR</label>
                <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={autoRejectSnr}
                    onChange={(event) => setAutoRejectSnr(Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs text-white"
                />
            </div>
            <div className="review-field">
                <label className="text-xs text-slate-400">Auto-reject speech</label>
                <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={autoRejectSpeech}
                    onChange={(event) => setAutoRejectSpeech(Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs text-white"
                />
            </div>
            <div className="review-field">
                <label className="text-xs text-slate-400">Auto-reject duration</label>
                <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={autoRejectDuration}
                    onChange={(event) => setAutoRejectDuration(Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs text-white"
                />
            </div>
        </div>
        <div className="review-actions">
            <button
                type="button"
                onClick={() => handleBatchDecision('accept')}
                className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
            >
                Accept Selected
            </button>
            <button
                type="button"
                onClick={() => handleBatchDecision('reject')}
                className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
            >
                Reject Selected
            </button>
            <button
                type="button"
                onClick={handleAutoReject}
                className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
            >
                Auto-reject
            </button>
        </div>
    </div>

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

            {/* Old inbox kept for reference (commented out) */}
            {false && (
                <div className="review-layout-old">
                    <div className="review-inbox glass rounded-2xl p-4">
                        <div className="review-section-header">
                            <h3 className="text-sm font-semibold text-white">Inbox</h3>
                            <span className="text-xs text-slate-500">{filteredInbox.length} pending</span>
                        </div>
                        <div
                            ref={listRef}
                            className={compactMode || perfMode ? 'review-list compact' : 'review-list'}
                            onScroll={handleListScroll}
                        >
                            <div style={{ height: totalItems * itemHeight, position: 'relative' }}>
                                <div style={{ transform: `translateY(${topSpacer}px)` }}>
                                    {visibleItems.map((segment) => (
                                        <div
                                            key={segment.index}
                                            className={`review-card ${activeId === segment.index ? 'active' : ''}`}
                                            onClick={() => setActiveId(segment.index)}
                                        >
                                            <div className="review-card-head">
                                                <label className="review-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(selected[segment.index])}
                                                        onChange={(event) =>
                                                            setSelected((prev) => ({
                                                                ...prev,
                                                                [segment.index]: event.target.checked,
                                                            }))
                                                        }
                                                    />
                                                    <span>#{segment.index}</span>
                                                </label>
                                                <div className="review-card-meta">
                                                    <span>{formatTime(segment.start)} - {formatTime(segment.end)}</span>
                                                    <span>{formatTime(segment.duration)}</span>
                                                </div>
                                            </div>
                                            {!perfMode && (
                                                <div className="review-badges">
                                                    <span className={badgeClass(segment.snrDb ?? null, 10, 6)}>
                                                        SNR {segment.snrDb?.toFixed?.(1) ?? 'n/a'}
                                                    </span>
                                                    <span className={badgeClass(segment.speechRatio ?? null, 0.7, 0.5)}>
                                                        Speech {segment.speechRatio?.toFixed?.(2) ?? 'n/a'}
                                                    </span>
                                                    <span className={badgeClass(segment.quality ?? null, 7, 5)}>
                                                        Quality {segment.quality ?? 'n/a'}
                                                    </span>
                                                </div>
                                            )}
                                            {!perfMode && (segment.labels.length > 0 || segment.rejectReason.length > 0) && (
                                                <div className="review-tags">
                                                    {segment.labels.map((label) => (
                                                        <span key={label} className="tag">{label}</span>
                                                    ))}
                                                    {segment.rejectReason.map((reason) => (
                                                        <span key={reason} className="tag tag-warn">{reason}</span>
                                                    ))}
                                                </div>
                                            )}
                                            {totalDuration > 0 && !perfMode && (
                                                <div className="review-mini">
                                                    <div className="review-mini-track">
                                                        <div
                                                            className="review-mini-fill"
                                                            style={{
                                                                left: `${(segment.start / totalDuration) * 100}%`,
                                                                width: `${Math.max(2, ((segment.end - segment.start) / totalDuration) * 100)}%`,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="review-card-actions">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setActiveId(segment.index);
                                                        playClean(segment);
                                                    }}
                                                    className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
                                                >
                                                    Play
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setDecision(segment.index, 'accept');
                                                    }}
                                                    className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setDecision(segment.index, 'reject');
                                                    }}
                                                    className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ height: bottomSpacer }} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* End old inbox */}

            {showTrays && !perfMode && (
                <div className="review-trays">
                    <div className="review-tray glass rounded-2xl p-4">
                        <div className="review-section-header">
                            <h3 className="text-sm font-semibold text-white">Accepted</h3>
                            <span className="text-xs text-slate-500">{acceptedList.length}</span>
                        </div>
                        <div className="review-tray-list">
                            {acceptedList.map((segment) => (
                                <div key={segment.index} className="review-tray-item">
                                    <div>
                                        <div className="text-xs text-slate-300">#{segment.index}</div>
                                        <div className="text-xs text-slate-500">{formatTime(segment.duration)}</div>
                                    </div>
                                    <div className="review-tray-actions">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveId(segment.index);
                                                playClean(segment);
                                            }}
                                            className="secondary-btn px-2 py-1 text-[11px] font-semibold rounded-lg"
                                        >
                                            Play
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => restoreDecision(segment.index)}
                                            className="secondary-btn px-2 py-1 text-[11px] font-semibold rounded-lg"
                                        >
                                            Restore
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="review-tray glass rounded-2xl p-4">
                        <div className="review-section-header">
                            <h3 className="text-sm font-semibold text-white">Rejected</h3>
                            <span className="text-xs text-slate-500">{rejectedList.length}</span>
                        </div>
                        <div className="review-tray-list">
                            {rejectedList.map((segment) => (
                                <div key={segment.index} className="review-tray-item">
                                    <div>
                                        <div className="text-xs text-slate-300">#{segment.index}</div>
                                        <div className="text-xs text-slate-500">{formatTime(segment.duration)}</div>
                                    </div>
                                    <div className="review-tray-actions">
                                        <button
                                            type="button"
                                            onClick={() => playSegment(segment)}
                                            className="secondary-btn px-2 py-1 text-[11px] font-semibold rounded-lg"
                                        >
                                            Play
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => restoreDecision(segment.index)}
                                            className="secondary-btn px-2 py-1 text-[11px] font-semibold rounded-lg"
                                        >
                                            Restore
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )}
    {activeSegment && (
        <div className="review-sticky-player">
            <div>
                <div className="text-xs text-slate-200">Active #{activeSegment.index}</div>
                <div className="text-[10px] text-slate-500">
                    {formatTime(activeSegment.start)} - {formatTime(activeSegment.end)}
                </div>
            </div>
            <div className="review-sticky-actions">
                <button
                    type="button"
                    onClick={togglePlay}
                    className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
                >
                    {playingId === activeSegment.index ? 'Pause' : 'Play'}
                </button>
                <button
                    type="button"
                    onClick={() => setPlaybackSource(playbackSource === 'clean' ? 'original' : 'clean')}
                    disabled={!originalPath}
                    className="secondary-btn px-3 py-2 text-xs font-semibold rounded-lg"
                >
                    {playbackSource === 'clean' ? 'A/B' : 'A/B'}
                </button>
            </div>
        </div>
    )}
</div>

{/* Chat feed panel - Telegram style */ }
{
    showChatFeed && (
        <div className="flex-[2] flex flex-col">
            <div className="bg-[#0e1621] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10" style={{ height: 'calc(100vh - 180px)' }}>
                {/* Chat header */}
                <div className="bg-gradient-to-r from-[#1a2332] to-[#1e2939] px-6 py-4 border-b border-white/10 flex items-center gap-3">
                    {transcriptionFeedStore.avatarUrl ? (
                        <img
                            src={transcriptionFeedStore.avatarUrl}
                            alt="Streamer"
                            className="w-10 h-10 rounded-full border-2 border-blue-400"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                            {streamerName?.charAt(0).toUpperCase() || 'S'}
                        </div>
                    )}
                    <div className="flex-1">
                        <h2 className="text-lg font-semibold text-white">
                            {streamerName || 'Transcriptions'}
                        </h2>
                        <p className="text-xs text-slate-400">
                            {transcriptionFeedStore.getSegmentsList().length} messages
                        </p>
                    </div>
                </div>

                {/* Chat messages */}
                <TranscriptionFeed
                    segments={transcriptionFeedStore.getSegmentsList()}
                    avatarUrl={transcriptionFeedStore.avatarUrl}
                    onSegmentClick={handleSegmentClick}
                    autoScroll={true}
                />
            </div>
        </div>
    )
}
                </div >
            </div >
        </div >
    );
};

export const ManualReviewPage: React.FC<ManualReviewPageProps> = ({ vodUrlOverride }) => {
    const [searchParams] = useSearchParams();
    let vodUrl = vodUrlOverride || searchParams.get('vodUrl') || '';

    // Dev mode: 'dev' translates to the development VOD
    if (vodUrl.toLowerCase() === 'dev') {
        vodUrl = 'https://www.twitch.tv/videos/2453173157';
    }

    return <ManualReviewPanel vodUrl={vodUrl} />;
};
