-- ============================================================
-- AutoDJ - Indexes
-- Migration: 20260328000003_indexes
--
-- Indexes para queries frequentes conforme a SPEC.
-- Partial unique indexes para deduplicacao de tracks.
-- ============================================================

-- =============================================================
-- PROVIDER_CONNECTIONS
-- =============================================================

CREATE INDEX idx_provider_connections_user_id
    ON public.provider_connections(user_id);

-- =============================================================
-- TRACKS
-- =============================================================

CREATE INDEX idx_tracks_user_id
    ON public.tracks(user_id);

CREATE INDEX idx_tracks_status
    ON public.tracks(status);

CREATE INDEX idx_tracks_spotify_id
    ON public.tracks(spotify_id)
    WHERE spotify_id IS NOT NULL;

CREATE INDEX idx_tracks_youtube_id
    ON public.tracks(youtube_id)
    WHERE youtube_id IS NOT NULL;

CREATE INDEX idx_tracks_audio_hash
    ON public.tracks(audio_hash)
    WHERE audio_hash IS NOT NULL;

-- Deduplicacao: mesmo usuario nao pode ter a mesma faixa do Spotify
CREATE UNIQUE INDEX idx_tracks_user_spotify
    ON public.tracks(user_id, spotify_id)
    WHERE spotify_id IS NOT NULL;

-- Deduplicacao: mesmo usuario nao pode ter o mesmo video do YouTube
CREATE UNIQUE INDEX idx_tracks_user_youtube
    ON public.tracks(user_id, youtube_id)
    WHERE youtube_id IS NOT NULL;

-- =============================================================
-- TRACK_ANALYSIS
-- =============================================================

CREATE INDEX idx_track_analysis_track_id
    ON public.track_analysis(track_id);

CREATE INDEX idx_track_analysis_bpm
    ON public.track_analysis(bpm);

CREATE INDEX idx_track_analysis_camelot
    ON public.track_analysis(camelot);

-- Composto para queries de ordenacao inteligente (BPM + camelot)
CREATE INDEX idx_track_analysis_bpm_camelot
    ON public.track_analysis(bpm, camelot);

-- Energy e danceability para filtros de busca
CREATE INDEX idx_track_analysis_energy
    ON public.track_analysis(energy);

CREATE INDEX idx_track_analysis_danceability
    ON public.track_analysis(danceability);

-- =============================================================
-- PLAYLISTS
-- =============================================================

CREATE INDEX idx_playlists_user_id
    ON public.playlists(user_id);

-- Deduplicacao: mesma playlist do provider para o mesmo usuario
CREATE UNIQUE INDEX idx_playlists_user_provider
    ON public.playlists(user_id, provider, provider_playlist_id)
    WHERE provider IS NOT NULL;

-- =============================================================
-- PLAYLIST_TRACKS
-- =============================================================

CREATE INDEX idx_playlist_tracks_playlist_id
    ON public.playlist_tracks(playlist_id);

CREATE INDEX idx_playlist_tracks_track_id
    ON public.playlist_tracks(track_id);

-- =============================================================
-- SETS
-- =============================================================

CREATE INDEX idx_sets_user_id
    ON public.sets(user_id);

CREATE INDEX idx_sets_status
    ON public.sets(status);

-- =============================================================
-- SET_TRACKS
-- =============================================================

CREATE INDEX idx_set_tracks_set_id
    ON public.set_tracks(set_id);

CREATE INDEX idx_set_tracks_track_id
    ON public.set_tracks(track_id);

-- =============================================================
-- JOBS
-- =============================================================

CREATE INDEX idx_jobs_user_id
    ON public.jobs(user_id);

CREATE INDEX idx_jobs_status
    ON public.jobs(status);

CREATE INDEX idx_jobs_type_status
    ON public.jobs(job_type, status);
