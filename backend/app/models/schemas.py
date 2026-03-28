from pydantic import BaseModel, Field


# --- Download ---


class DownloadRequest(BaseModel):
    track_id: str
    query: str | None = None
    youtube_id: str | None = None
    artist: str | None = None
    title: str | None = None


class BatchDownloadRequest(BaseModel):
    tracks: list[DownloadRequest]


class BatchDownloadResponse(BaseModel):
    track_ids: list[str]
    message: str = "Downloads scheduled"


# --- Analysis ---


class AnalysisRequest(BaseModel):
    track_id: str


class BatchAnalysisRequest(BaseModel):
    tracks: list[AnalysisRequest]


class BatchAnalysisResponse(BaseModel):
    track_ids: list[str]
    message: str = "Analysis scheduled"


class TrackAnalysis(BaseModel):
    bpm: float
    bpm_confidence: float = Field(ge=0, le=1)
    key: str
    key_confidence: float = Field(ge=0, le=1)
    camelot: str
    energy: float = Field(ge=0, le=1)
    danceability: float = Field(ge=0, le=1)
    loudness_db: float
    intro_end_seconds: float = 0.0
    outro_start_seconds: float = 0.0


# --- Ordering ---


class TrackForOrdering(BaseModel):
    track_id: str
    bpm: float
    camelot: str
    energy: float
    danceability: float
    title: str = ""


class OrderedTrack(BaseModel):
    track_id: str
    position: int
    title: str = ""
    transition_score: float = Field(
        ge=0, le=1, description="Qualidade da transicao com a track anterior"
    )


class OrderingRequest(BaseModel):
    tracks: list[TrackForOrdering]
    start_track_id: str | None = None


class OrderingResponse(BaseModel):
    ordered_tracks: list[OrderedTrack]
    total_score: float


# --- YouTube Search ---


class YouTubeSearchResult(BaseModel):
    video_id: str
    title: str
    duration_seconds: int | None = None
    channel: str = ""


# --- Download Result (interno) ---


class DownloadResult(BaseModel):
    path: str
    format: str
    size_bytes: int
    youtube_id: str
