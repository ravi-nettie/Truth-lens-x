"""backend/app/config.py

Application settings and directory management for TruthLens X.
Loads configuration from .env using pydantic-settings.
Enforces local-first storage boundaries (Rule 3).
"""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Ingestion constraints
    MAX_UPLOAD_MB: int = 200
    MAX_VIDEO_DURATION_SEC: int = 300

    # Local CPU models
    WHISPER_MODEL: str = "tiny.en"
    WHISPER_COMPUTE_TYPE: str = "int8"
    ENABLE_OPTIONAL_MODELS: bool = False

    # Storage paths
    DATA_DIR: str = "./data"
    MODELS_DIR: str = "./models"
    DB_NAME: str = "truth_lens.db"

    # UI / Mock toggle
    VITE_USE_MOCKS: bool = False

    @property
    def data_path(self) -> Path:
        return Path(self.DATA_DIR).resolve()

    @property
    def evidence_dir(self) -> Path:
        return self.data_path / "evidence"

    @property
    def artifacts_dir(self) -> Path:
        return self.data_path / "artifacts"

    @property
    def tmp_dir(self) -> Path:
        return self.data_path / "tmp"

    @property
    def db_path(self) -> Path:
        return self.data_path / self.DB_NAME

    @property
    def models_path(self) -> Path:
        return Path(self.MODELS_DIR).resolve()

    def ensure_dirs(self) -> None:
        """Ensures core storage directories exist on startup."""
        self.evidence_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.tmp_dir.mkdir(parents=True, exist_ok=True)
        self.models_path.mkdir(parents=True, exist_ok=True)


settings = Settings()
settings.ensure_dirs()

