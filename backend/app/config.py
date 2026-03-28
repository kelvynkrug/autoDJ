from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    AUDIO_TEMP_DIR: str = "/tmp/autodj-audio"
    MAX_CONCURRENT_DOWNLOADS: int = 3
    YTDLP_FORMAT: str = "bestaudio[ext=m4a]/bestaudio/best"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def ensure_temp_dir(self) -> Path:
        path = Path(self.AUDIO_TEMP_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path


settings = Settings()  # type: ignore[call-arg]
