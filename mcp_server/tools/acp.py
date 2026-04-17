"""ACP tools for agent registration and inter-agent messaging."""
from __future__ import annotations

import json
from typing import Any

from agentic_ai.config.settings import settings

from ..validation import sanitize_metadata
from .common import coerce_positive_int, validation_error


def _acp_enabled_error() -> dict[str, Any] | None:
    if not settings.acp_enabled:
        return validation_error("acp_enabled", "ACP is disabled by configuration")
    return None


def _validate_capabilities(capabilities: list[str]) -> dict[str, Any] | None:
    if len(capabilities) > settings.acp_max_capabilities:
        return validation_error(
            "capabilities",
            f"too many capabilities ({len(capabilities)} > {settings.acp_max_capabilities})",
        )
    return None


def _validate_payload_size(payload: dict[str, Any]) -> dict[str, Any] | None:
    serialized = json.dumps(payload, default=str)
    if len(serialized) > settings.acp_max_payload_chars:
        return validation_error(
            "payload",
            f"payload exceeds max size ({len(serialized)} > {settings.acp_max_payload_chars})",
        )
    return None


def register_acp_tools(mcp, runtime, logger) -> None:
    @mcp.tool()
    async def acp_register_agent(
        agent_id: str,
        display_name: str = "",
        capabilities: list[str] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Register or refresh an ACP-capable agent identity."""
        enabled_error = _acp_enabled_error()
        if enabled_error:
            return enabled_error
        capabilities_list = capabilities or []
        cap_error = _validate_capabilities(capabilities_list)
        if cap_error:
            return cap_error
        try:
            metadata_clean = sanitize_metadata(metadata or {})
        except ValueError as exc:
            return validation_error("metadata", str(exc))
        try:
            record = await runtime.acp.register_agent(
                agent_id=str(agent_id).strip(),
                display_name=display_name,
                capabilities=capabilities_list,
                metadata=metadata_clean,
            )
            return {"registered": True, "agent": record.model_dump()}
        except ValueError as exc:
            return validation_error("agent_id", str(exc))

    @mcp.tool()
    async def acp_unregister_agent(agent_id: str) -> dict[str, Any]:
        """Unregister an ACP agent identity."""
        enabled_error = _acp_enabled_error()
        if enabled_error:
            return enabled_error
        normalized = str(agent_id).strip()
        if not normalized:
            return validation_error("agent_id", "required")
        removed = await runtime.acp.unregister_agent(normalized)
        return {"agent_id": normalized, "unregistered": removed}

    @mcp.tool()
    async def acp_heartbeat(agent_id: str) -> dict[str, Any]:
        """Update ACP heartbeat for an active agent."""
        enabled_error = _acp_enabled_error()
        if enabled_error:
            return enabled_error
        normalized = str(agent_id).strip()
        if not normalized:
            return validation_error("agent_id", "required")
        record = await runtime.acp.heartbeat(normalized)
        if record is None:
            return validation_error("agent_id", "agent is not registered")
        return {"agent": record.model_dump()}

    @mcp.tool()
    async def acp_send_message(
        sender_id: str,
        recipient_id: str,
        payload: dict[str, Any],
        message_type: str = "event",
        conversation_id: str = "",
        priority: int = 5,
        ttl_seconds: int = 0,
    ) -> dict[str, Any]:
        """Send ACP message from one registered agent to another."""
        enabled_error = _acp_enabled_error()
        if enabled_error:
            return enabled_error
        safe_priority, priority_error = coerce_positive_int(priority, "priority", 5, 10)
        if priority_error:
            return priority_error

        safe_ttl, ttl_error = coerce_positive_int(ttl_seconds, "ttl_seconds", 0, 1_000_000)
        if ttl_error:
            return ttl_error

        payload_error = _validate_payload_size(payload or {})
        if payload_error:
            return payload_error

        try:
            message = await runtime.acp.send_message(
                sender_id=str(sender_id).strip(),
                recipient_id=str(recipient_id).strip(),
                payload=payload or {},
                message_type=message_type,
                conversation_id=conversation_id,
                priority=safe_priority,
                ttl_seconds=safe_ttl if safe_ttl > 0 else None,
            )
            logger.info(
                "tool.acp_send_message.complete",
                sender_id=message.sender_id,
                recipient_id=message.recipient_id,
                message_id=message.message_id,
            )
            return {"sent": True, "message": message.model_dump()}
        except ValueError as exc:
            return validation_error("message", str(exc))

    @mcp.tool()
    async def acp_fetch_inbox(
        agent_id: str,
        limit: int = 20,
        include_acknowledged: bool = False,
    ) -> dict[str, Any]:
        """Fetch ACP inbox for a registered agent."""
        enabled_error = _acp_enabled_error()
        if enabled_error:
            return enabled_error
        safe_limit, limit_error = coerce_positive_int(limit, "limit", 20, 200)
        if limit_error:
            return limit_error

        try:
            messages = await runtime.acp.fetch_inbox(
                agent_id=str(agent_id).strip(),
                limit=safe_limit,
                include_acknowledged=include_acknowledged,
            )
            return {
                "agent_id": str(agent_id).strip(),
                "count": len(messages),
                "messages": messages,
            }
        except ValueError as exc:
            return validation_error("agent_id", str(exc))

    @mcp.tool()
    async def acp_acknowledge_message(agent_id: str, message_id: str) -> dict[str, Any]:
        """Acknowledge ACP message delivery by recipient."""
        enabled_error = _acp_enabled_error()
        if enabled_error:
            return enabled_error
        normalized_agent = str(agent_id).strip()
        normalized_message = str(message_id).strip()
        if not normalized_agent:
            return validation_error("agent_id", "required")
        if not normalized_message:
            return validation_error("message_id", "required")

        try:
            message = await runtime.acp.acknowledge_message(
                agent_id=normalized_agent,
                message_id=normalized_message,
            )
            return {"acknowledged": True, "message": message.model_dump()}
        except ValueError as exc:
            return validation_error("message_id", str(exc))

    @mcp.tool()
    async def acp_list_agents() -> dict[str, Any]:
        """List all currently registered ACP agents."""
        enabled_error = _acp_enabled_error()
        if enabled_error:
            return enabled_error
        agents = await runtime.acp.list_agents()
        return {"count": len(agents), "agents": agents}

    @mcp.tool()
    async def acp_get_message(message_id: str) -> dict[str, Any]:
        """Get ACP message envelope by message id."""
        enabled_error = _acp_enabled_error()
        if enabled_error:
            return enabled_error
        normalized = str(message_id).strip()
        if not normalized:
            return validation_error("message_id", "required")
        message = await runtime.acp.get_message(normalized)
        if message is None:
            return {"message_id": normalized, "status": "not_found"}
        return {"message": message.model_dump()}

