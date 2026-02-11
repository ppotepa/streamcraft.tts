/**
 * VOD run domain types
 */

export interface RunParams {
    mode: string;
    preset: string;
    strictness: number;
    extract_vocals: boolean;
    preserve_pauses: boolean;
    reduce_sfx: boolean;
    target_lufs: number;
    true_peak_limit_db: number;
    fade_ms: number;
    voice_sample_count?: number;
    voice_sample_min_duration?: number;
    voice_sample_max_duration?: number;
    voice_sample_min_rms_db?: number;
}

export interface RunStats {
    total_segments: number;
    kept_segments: number;
    total_duration: number;
    clean_duration: number;
    rejection_reasons?: Record<string, number>;
}

export interface VodRun {
    run_id: string;
    created_at: string;
    vod_url: string;
    streamer: string;
    vod_identifier: string | null;
    status: 'in_progress' | 'completed' | 'failed' | 'canceled';
    params: RunParams;
    stats: RunStats | null;
    segments_manifest: string | null;
    clean_audio: string | null;
    error_message: string | null;
    completed_at: string | null;
}

export interface RunListResponse {
    runs: VodRun[];
    total: number;
}
