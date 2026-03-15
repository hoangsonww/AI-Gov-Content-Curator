"""
Pydantic models for MCP request and job state.
"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ArticleProcessRequest(BaseModel):
    """Validated request schema for article processing."""

    model_config = ConfigDict(extra="forbid")

    article_id: str = Field(..., min_length=1, max_length=128)
    content: str = Field(..., min_length=1)
    url: str = Field(default="", max_length=2048)
    source: str = Field(default="", max_length=256)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("article_id", mode="before")
    @classmethod
    def clean_article_id(cls, value: Any) -> str:
        cleaned = str(value).strip()
        if not cleaned:
            raise ValueError("article_id cannot be empty")
        return cleaned


class ProcessingStatus(BaseModel):
    """Status model for article processing jobs."""

    article_id: str
    status: str  # pending, processing, completed, failed, not_found
    progress: float
    current_stage: Optional[str] = None
    started_at: str
    completed_at: Optional[str] = None
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None
