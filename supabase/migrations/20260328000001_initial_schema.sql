-- ============================================================
-- AutoDJ - Schema Inicial
-- Migration: 20260328000001_initial_schema
--
-- Supabase usa auth.users nativo. Criamos profiles como
-- extensao e as demais tabelas de dominio.
-- ============================================================

-- =============================================================
-- ENUMS
-- =============================================================

CREATE TYPE provider_type AS ENUM ('spotify', 'google');
CREATE TYPE track_status AS ENUM ('pending', 'searching', 'downloading', 'analyzing', 'ready', 'error');
CREATE TYPE set_status AS ENUM ('draft', 'ready', 'playing', 'paused', 'finished');
CREATE TYPE transition_type AS ENUM ('crossfade', 'eq_swap', 'filter_sweep');
CREATE TYPE camelot_key AS ENUM (
    '1A','1B','2A','2B','3A','3B','4A','4B',
    '5A','5B','6A','6B','7A','7B','8A','8B',
    '9A','9B','10A','10B','11A','11B','12A','12B'
);

-- =============================================================
-- PROFILES (extends auth.users)
-- =============================================================

CREATE TABLE public.profiles (
    id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name VARCHAR(255),
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Perfil publico do usuario, vinculado a auth.users do Supabase';

-- Cria profile automaticamente ao registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- PROVIDER_CONNECTIONS (tokens OAuth de providers de musica)
-- =============================================================

CREATE TABLE public.provider_connections (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider         provider_type NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    display_name     VARCHAR(255),
    access_token     TEXT NOT NULL,
    refresh_token    TEXT,
    token_expires_at TIMESTAMPTZ,
    scopes           TEXT,
    connected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, provider)
);

COMMENT ON TABLE public.provider_connections IS 'Conexoes OAuth com Spotify/Google para cada usuario';

-- =============================================================
-- TRACKS
-- =============================================================

CREATE TABLE public.tracks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title            VARCHAR(500) NOT NULL,
    artist           VARCHAR(500) NOT NULL,
    album            VARCHAR(500),
    duration_ms      INTEGER,
    cover_url        TEXT,

    -- Origem
    spotify_id       VARCHAR(255),
    youtube_id       VARCHAR(255),

    -- Audio (armazenado no Supabase Storage)
    audio_path       TEXT,
    audio_format     VARCHAR(10),
    audio_size_bytes BIGINT,
    audio_hash       VARCHAR(64),

    status           track_status NOT NULL DEFAULT 'pending',
    error_message    TEXT,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tracks IS 'Faixas de musica importadas pelo usuario';

-- =============================================================
-- TRACK_ANALYSIS
-- =============================================================

CREATE TABLE public.track_analysis (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id         UUID UNIQUE NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,

    bpm              REAL NOT NULL,
    bpm_confidence   REAL,
    key              VARCHAR(5),
    key_confidence   REAL,
    camelot          camelot_key,
    energy           REAL NOT NULL CHECK (energy >= 0 AND energy <= 1),
    danceability     REAL NOT NULL CHECK (danceability >= 0 AND danceability <= 1),
    loudness_db      REAL,

    intro_end_s      REAL,
    outro_start_s    REAL,
    first_beat_s     REAL,

    analysis_version VARCHAR(20) NOT NULL DEFAULT '1.0',
    raw_data         JSONB,

    analyzed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.track_analysis IS 'Resultado da analise de audio (Essentia) por faixa';

-- =============================================================
-- PLAYLISTS
-- =============================================================

CREATE TABLE public.playlists (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                 VARCHAR(500) NOT NULL,
    description          TEXT,
    cover_url            TEXT,

    provider             provider_type,
    provider_playlist_id VARCHAR(255),

    track_count          INTEGER NOT NULL DEFAULT 0,

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.playlists IS 'Playlists importadas ou criadas pelo usuario';

-- =============================================================
-- PLAYLIST_TRACKS (junction table)
-- =============================================================

CREATE TABLE public.playlist_tracks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
    track_id    UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(playlist_id, track_id),
    UNIQUE(playlist_id, position)
);

-- =============================================================
-- SETS (sessoes de mixagem)
-- =============================================================

CREATE TABLE public.sets (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    playlist_id       UUID REFERENCES public.playlists(id) ON DELETE SET NULL,
    name              VARCHAR(500) NOT NULL,
    status            set_status NOT NULL DEFAULT 'draft',

    transition_type   transition_type NOT NULL DEFAULT 'crossfade',
    transition_beats  INTEGER NOT NULL DEFAULT 16 CHECK (transition_beats >= 4 AND transition_beats <= 32),
    auto_order        BOOLEAN NOT NULL DEFAULT true,

    total_duration_ms BIGINT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at        TIMESTAMPTZ,
    finished_at       TIMESTAMPTZ
);

COMMENT ON TABLE public.sets IS 'Sessoes de mixagem automatica do DJ';

-- =============================================================
-- SET_TRACKS
-- =============================================================

CREATE TABLE public.set_tracks (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id                UUID NOT NULL REFERENCES public.sets(id) ON DELETE CASCADE,
    track_id              UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    position              INTEGER NOT NULL,

    transition_start_s    REAL,
    transition_duration_s REAL,
    transition_type       transition_type,
    bpm_adjusted          REAL,
    gain_db               REAL DEFAULT 0,

    compatibility_score   REAL CHECK (compatibility_score >= 0 AND compatibility_score <= 1),

    UNIQUE(set_id, position)
);

-- =============================================================
-- JOBS (tracking de tarefas assincronas)
-- =============================================================

CREATE TABLE public.jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_type        VARCHAR(50) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',

    total_items     INTEGER,
    completed_items INTEGER DEFAULT 0,
    failed_items    INTEGER DEFAULT 0,

    payload         JSONB,
    result          JSONB,
    error_message   TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

COMMENT ON TABLE public.jobs IS 'Jobs assincronos (download, analise, etc.)';

-- =============================================================
-- FUNCAO UTILITARIA: updated_at automatico
-- =============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica trigger de updated_at em todas as tabelas relevantes
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.provider_connections
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tracks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.playlists
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sets
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
