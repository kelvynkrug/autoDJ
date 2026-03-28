-- ============================================================
-- AutoDJ - Row Level Security (RLS)
-- Migration: 20260328000002_rls_policies
--
-- Regra geral: cada usuario so acessa seus proprios dados.
-- Tabelas de juncao (playlist_tracks, set_tracks) usam
-- join com a tabela pai para verificar ownership.
-- ============================================================

-- =============================================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- =============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.track_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- PROFILES
-- =============================================================

CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- =============================================================
-- PROVIDER_CONNECTIONS
-- =============================================================

CREATE POLICY "provider_connections_select_own"
    ON public.provider_connections FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "provider_connections_insert_own"
    ON public.provider_connections FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "provider_connections_update_own"
    ON public.provider_connections FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "provider_connections_delete_own"
    ON public.provider_connections FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================
-- TRACKS
-- =============================================================

CREATE POLICY "tracks_select_own"
    ON public.tracks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "tracks_insert_own"
    ON public.tracks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tracks_update_own"
    ON public.tracks FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tracks_delete_own"
    ON public.tracks FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================
-- TRACK_ANALYSIS
-- Via join com tracks para verificar ownership
-- =============================================================

CREATE POLICY "track_analysis_select_own"
    ON public.track_analysis FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tracks
            WHERE tracks.id = track_analysis.track_id
              AND tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "track_analysis_insert_own"
    ON public.track_analysis FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tracks
            WHERE tracks.id = track_analysis.track_id
              AND tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "track_analysis_update_own"
    ON public.track_analysis FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tracks
            WHERE tracks.id = track_analysis.track_id
              AND tracks.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tracks
            WHERE tracks.id = track_analysis.track_id
              AND tracks.user_id = auth.uid()
        )
    );

CREATE POLICY "track_analysis_delete_own"
    ON public.track_analysis FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.tracks
            WHERE tracks.id = track_analysis.track_id
              AND tracks.user_id = auth.uid()
        )
    );

-- =============================================================
-- PLAYLISTS
-- =============================================================

CREATE POLICY "playlists_select_own"
    ON public.playlists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "playlists_insert_own"
    ON public.playlists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "playlists_update_own"
    ON public.playlists FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "playlists_delete_own"
    ON public.playlists FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================
-- PLAYLIST_TRACKS
-- Via join com playlists para verificar ownership
-- =============================================================

CREATE POLICY "playlist_tracks_select_own"
    ON public.playlist_tracks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE playlists.id = playlist_tracks.playlist_id
              AND playlists.user_id = auth.uid()
        )
    );

CREATE POLICY "playlist_tracks_insert_own"
    ON public.playlist_tracks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE playlists.id = playlist_tracks.playlist_id
              AND playlists.user_id = auth.uid()
        )
    );

CREATE POLICY "playlist_tracks_update_own"
    ON public.playlist_tracks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE playlists.id = playlist_tracks.playlist_id
              AND playlists.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE playlists.id = playlist_tracks.playlist_id
              AND playlists.user_id = auth.uid()
        )
    );

CREATE POLICY "playlist_tracks_delete_own"
    ON public.playlist_tracks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.playlists
            WHERE playlists.id = playlist_tracks.playlist_id
              AND playlists.user_id = auth.uid()
        )
    );

-- =============================================================
-- SETS
-- =============================================================

CREATE POLICY "sets_select_own"
    ON public.sets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "sets_insert_own"
    ON public.sets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sets_update_own"
    ON public.sets FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sets_delete_own"
    ON public.sets FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================
-- SET_TRACKS
-- Via join com sets para verificar ownership
-- =============================================================

CREATE POLICY "set_tracks_select_own"
    ON public.set_tracks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sets
            WHERE sets.id = set_tracks.set_id
              AND sets.user_id = auth.uid()
        )
    );

CREATE POLICY "set_tracks_insert_own"
    ON public.set_tracks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sets
            WHERE sets.id = set_tracks.set_id
              AND sets.user_id = auth.uid()
        )
    );

CREATE POLICY "set_tracks_update_own"
    ON public.set_tracks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.sets
            WHERE sets.id = set_tracks.set_id
              AND sets.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sets
            WHERE sets.id = set_tracks.set_id
              AND sets.user_id = auth.uid()
        )
    );

CREATE POLICY "set_tracks_delete_own"
    ON public.set_tracks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.sets
            WHERE sets.id = set_tracks.set_id
              AND sets.user_id = auth.uid()
        )
    );

-- =============================================================
-- JOBS (somente select e insert pelo usuario)
-- =============================================================

CREATE POLICY "jobs_select_own"
    ON public.jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "jobs_insert_own"
    ON public.jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);
