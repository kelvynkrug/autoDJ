-- ============================================================
-- AutoDJ - Storage Buckets & Policies
-- Migration: 20260328000004_storage
--
-- Bucket 'audio' para arquivos de audio das tracks.
-- Estrutura de pastas: audio/{user_id}/{track_id}.{ext}
-- ============================================================

-- Cria bucket privado para audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'audio',
    'audio',
    false,
    104857600,  -- 100MB
    ARRAY['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/flac']
);

-- =============================================================
-- POLICIES DO STORAGE
-- =============================================================

-- Usuario pode ler seus proprios arquivos de audio
-- Estrutura esperada: audio/{user_id}/...
CREATE POLICY "Users can read own audio"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Usuario pode fazer upload nos seus proprios arquivos
CREATE POLICY "Users can upload own audio"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Usuario pode deletar seus proprios arquivos
CREATE POLICY "Users can delete own audio"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'audio'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Service role pode fazer qualquer operacao (backend FastAPI)
-- Nota: service_role bypassa RLS por padrao no Supabase,
-- entao nao precisa de policy explicita.
