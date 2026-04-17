"""Pydantic models for ACP agent communication primitives."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ACPAgentRecord(BaseModel):
    """Registered ACP agent identity and liveness data."""

    model_config = ConfigDict(extra="forbid")

    agent_id: str = Field(..., min_length=1, max_length=128)
    display_name: str = Field(default="", max_length=256)
    capabilities: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    status: str = Field(default="active")
    registered_at: str
    last_heartbeat_at: str

    @field_validator("agent_id", mode="before")
    @classmethod
    def clean_agent_id(cls, value: Any) -> str:
        cleaned = str(value).strip()
        if not cleaned:
            raise ValueError("agent_id cannot be empty")
        return cleaned


class ACPMessageRecord(BaseModel):
    """Message envelope for ACP inter-agent communication."""

    model_config = ConfigDict(extra="forbid")

    message_id: str = Field(..., min_length=1, max_length=128)
    conversation_id: str = Field(default="", max_length=128)
    sender_id: str = Field(..., min_length=1, max_length=128)
    recipient_id: str = Field(..., min_length=1, max_length=128)
    message_type: str = Field(default="event", max_length=64)
    payload: dict[str, Any] = Field(default_factory=dict)
    priority: int = Field(default=5, ge=0, le=10)
    status: str = Field(default="pending")
    created_at: str
    expires_at: str
    delivered_at: str | None = None
    acknowledged_at: str | None = None

