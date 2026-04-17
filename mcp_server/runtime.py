"""
Runtime wiring for pipeline + job store.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

import structlog
from uuid import uuid4

from agentic_ai.config.settings import settings

from .acp_redis_store import RedisACPStore
from .acp_store import ACPStore, ACPStoreProtocol
from .job_store import ProcessingJobStore
from .utils import utc_now_iso

if TYPE_CHECKING:  # pragma: no cover - typing only
    from agentic_ai.core.pipeline import AgenticPipeline


class ServerRuntime:
    """
    Runtime container shared by MCP tools/resources.
    """

    def __init__(self) -> None:
        self.logger = structlog.get_logger("mcp_server.runtime")
        self.started_at = utc_now_iso()
        self.pipeline: "AgenticPipeline | None" = None
        self.ready = False
        self.startup_error: str | None = None
        self.acp_backend = settings.acp_backend

        try:
            from agentic_ai.core.pipeline import AgenticPipeline

            self.pipeline = AgenticPipeline()
            self.ready = True
        except Exception as exc:  # pragma: no cover - startup safety net
            self.startup_error = str(exc)
            self.logger.error("pipeline_initialization_failed", error=self.startup_error)

        self.jobs = ProcessingJobStore(
            max_history=settings.mcp_max_job_history,
            ttl_seconds=settings.mcp_job_ttl_seconds,
        )
        self.acp: ACPStoreProtocol = self._build_acp_store()

    def readiness(self) -> dict[str, Any]:
        return {
            "ready": self.ready and self.pipeline is not None,
            "startup_error": self.startup_error,
            "started_at": self.started_at,
            "acp_backend": self.acp_backend,
        }

    async def acp_preflight(self) -> dict[str, Any]:
        if not settings.acp_enabled:
            return {"enabled": False, "ready": True, "checks": {"acp_enabled": False}}

        sender_id = f"preflight-sender-{uuid4().hex[:12]}"
        recipient_id = f"preflight-recipient-{uuid4().hex[:12]}"
        checks: dict[str, Any] = {"backend": self.acp_backend}
        try:
            if self.acp_backend == "redis" and hasattr(self.acp, "redis"):
                checks["redis_ping"] = bool(await self.acp.redis.ping())

            await self.acp.register_agent(agent_id=sender_id, capabilities=["preflight"])
            await self.acp.register_agent(agent_id=recipient_id, capabilities=["preflight"])
            message = await self.acp.send_message(
                sender_id=sender_id,
                recipient_id=recipient_id,
                payload={"preflight": True},
                message_type="healthcheck",
            )
            inbox = await self.acp.fetch_inbox(agent_id=recipient_id, limit=1)
            checks["inbox_received"] = bool(
                inbox and inbox[0].get("message_id") == message.message_id
            )
            await self.acp.acknowledge_message(agent_id=recipient_id, message_id=message.message_id)
            checks["message_acknowledged"] = True
            return {"enabled": True, "ready": all(bool(v) for v in checks.values()), "checks": checks}
        except Exception as exc:  # pragma: no cover - safety net for operations
            return {
                "enabled": True,
                "ready": False,
                "checks": checks,
                "error": str(exc),
            }
        finally:
            try:
                await self.acp.unregister_agent(sender_id)
                await self.acp.unregister_agent(recipient_id)
            except Exception:
                pass

    def _build_acp_store(self) -> ACPStoreProtocol:
        normalized_backend = settings.acp_backend.strip().lower()
        strict_redis_required = (
            settings.acp_enabled
            and settings.environment.strip().lower() == "production"
            and normalized_backend == "redis"
        )

        if normalized_backend == "redis":
            try:
                from redis.asyncio import Redis

                redis_client = Redis(
                    host=settings.redis_host,
                    port=settings.redis_port,
                    db=settings.redis_db,
                    password=settings.redis_password,
                    decode_responses=True,
                )
                self.acp_backend = "redis"
                return RedisACPStore(
                    redis_client=redis_client,
                    key_prefix=settings.acp_redis_key_prefix,
                    max_agents=settings.acp_max_agents,
                    max_messages=settings.acp_max_messages,
                    default_message_ttl_seconds=settings.acp_message_ttl_seconds,
                    agent_ttl_seconds=settings.acp_agent_ttl_seconds,
                )
            except Exception as exc:  # pragma: no cover - defensive fallback
                if strict_redis_required:
                    raise RuntimeError(
                        "ACP redis backend is required in production but unavailable"
                    ) from exc
                self.logger.warning("acp.redis_unavailable_falling_back_to_memory", error=str(exc))

        if strict_redis_required:
            raise RuntimeError("ACP redis backend is required in production")

        self.acp_backend = "memory"
        return ACPStore(
            max_agents=settings.acp_max_agents,
            max_messages=settings.acp_max_messages,
            default_message_ttl_seconds=settings.acp_message_ttl_seconds,
        )
