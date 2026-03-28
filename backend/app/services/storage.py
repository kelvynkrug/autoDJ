"""Upload/download de arquivos de audio no Supabase Storage."""

import logging
from pathlib import Path

from app.dependencies import get_supabase_client

logger = logging.getLogger(__name__)

BUCKET_NAME = "audio"


def upload_audio(file_path: str, storage_path: str) -> str:
    """
    Faz upload de arquivo para Supabase Storage.
    Retorna a URL publica/signed do arquivo.
    """
    client = get_supabase_client()
    local = Path(file_path)

    if not local.exists():
        raise FileNotFoundError(f"Arquivo nao encontrado: {file_path}")

    content_type = _get_content_type(local.suffix)

    with open(file_path, "rb") as f:
        data = f.read()

    try:
        client.storage.from_(BUCKET_NAME).upload(
            path=storage_path,
            file=data,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    except Exception:
        logger.exception("Erro no upload: %s -> %s", file_path, storage_path)
        raise

    logger.info("Upload concluido: %s -> %s/%s", file_path, BUCKET_NAME, storage_path)
    return f"{BUCKET_NAME}/{storage_path}"


def download_audio(storage_path: str, output_path: str) -> str:
    """Baixa arquivo do Supabase Storage para disco local."""
    client = get_supabase_client()

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    try:
        data = client.storage.from_(BUCKET_NAME).download(storage_path)
    except Exception:
        logger.exception("Erro no download do Storage: %s", storage_path)
        raise

    with open(output_path, "wb") as f:
        f.write(data)

    logger.info("Download do Storage concluido: %s -> %s", storage_path, output_path)
    return output_path


def get_signed_url(storage_path: str, expires_in: int = 3600) -> str:
    """Gera URL assinada para acesso temporario."""
    client = get_supabase_client()
    result = client.storage.from_(BUCKET_NAME).create_signed_url(storage_path, expires_in)
    return result["signedURL"]


def _get_content_type(suffix: str) -> str:
    types = {
        ".m4a": "audio/mp4",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
        ".opus": "audio/opus",
        ".wav": "audio/wav",
        ".webm": "audio/webm",
    }
    return types.get(suffix.lower(), "application/octet-stream")
