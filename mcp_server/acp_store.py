"""In-memory ACP registry and message routing store."""
from __future__ import annotations

import asyncio
from collections import deque
from datetime import datetime, timedelta
from typing import Protocol
from uuid import uuid4

from .acp_models import ACPAgentRecord, ACPMessageRecord
from .utils import utc_now, utc_now_iso


class ACPStoreProtocol(Protocol):
    async def register_agent(
        self,
        *,
        agent_id: str,
        display_name: str = "",
        capabilities: list[str] | None = None,
        metadata: dict | None = None,
    ) -> ACPAgentRecord: ...

    async def unregister_agent(self, agent_id: str) -> bool: ...

    async def heartbeat(self, agent_id: str) -> ACPAgentRecord | None: ...

    async def list_agents(self) -> list[dict]: ...

    async def send_message(
        self,
        *,
        sender_id: str,
        recipient_id: str,
        payload: dict,
        message_type: str = "event",
        conversation_id: str = "",
        priority: int = 5,
        ttl_seconds: int | None = None,
    ) -> ACPMessageRecord: ...

    async def get_message(self, message_id: str) -> ACPMessageRecord | None: ...

    async def fetch_inbox(self, *, agent_id: str, limit: int, include_acknowledged: bool = False) -> list[dict]: ...

    async def acknowledge_message(self, *, agent_id: str, message_id: str) -> ACPMessageRecord: ...

    async def list_recent_messages(self, *, limit: int = 20, offset: int = 0) -> list[dict]: ...

    async def stats(self) -> dict[str, int]: ...


class InMemoryACPStore:
    """Async-safe ACP store with retention and lifecycle controls."""

    def __init__(self, *, max_agents: int, max_messages: int, default_message_ttl_seconds: int):
        self.max_agents = max_agents
        self.max_messages = max_messages
        self.default_message_ttl_seconds = default_message_ttl_seconds

        self._agents: dict[str, ACPAgentRecord] = {}
        self._messages: dict[str, ACPMessageRecord] = {}
        self._inbox: dict[str, deque[str]] = {}
        self._order: deque[str] = deque()
        self._lock = asyncio.Lock()

    async def register_agent(
        self,
        *,
        agent_id: str,
        display_name: str = "",
        capabilities: list[str] | None = None,
        metadata: dict | None = None,
    ) -> ACPAgentRecord:
        async with self._lock:
            existing = self._agents.get(agent_id)
            timestamp = utc_now_iso()
            record = ACPAgentRecord(
                agent_id=agent_id,
                display_name=display_name.strip(),
                capabilities=(capabilities or []),
                metadata=(metadata or {}),
                status="active",
                registered_at=existing.registered_at if existing else timestamp,
                last_heartbeat_at=timestamp,
            )

            if existing is None and len(self._agents) >= self.max_agents:
                raise ValueError(f"max registered agents exceeded ({self.max_agents})")

            self._agents[agent_id] = record
            self._inbox.setdefault(agent_id, deque())
            return record

    async def unregister_agent(self, agent_id: str) -> bool:
        async with self._lock:
            existed = agent_id in self._agents
            self._agents.pop(agent_id, None)
            self._inbox.pop(agent_id, None)
            return existed

    async def heartbeat(self, agent_id: str) -> ACPAgentRecord | None:
        async with self._lock:
            record = self._agents.get(agent_id)
            if record is None:
                return None
            record.last_heartbeat_at = utc_now_iso()
            return record

    async def list_agents(self) -> list[dict]:
        async with self._lock:
            return [agent.model_dump() for agent in self._agents.values()]

    async def send_message(
        self,
        *,
        sender_id: str,
        recipient_id: str,
        payload: dict,
        message_type: str = "event",
        conversation_id: str = "",
        priority: int = 5,
        ttl_seconds: int | None = None,
    ) -> ACPMessageRecord:
        async with self._lock:
            await self._prune_locked()

            if sender_id not in self._agents:
                raise ValueError(f"sender agent '{sender_id}' is not registered")
            if recipient_id not in self._agents:
                raise ValueError(f"recipient agent '{recipient_id}' is not registered")

            effective_ttl = ttl_seconds if ttl_seconds and ttl_seconds > 0 else self.default_message_ttl_seconds
            created_at = utc_now()
            message = ACPMessageRecord(
                message_id=f"msg_{uuid4().hex}",
                conversation_id=conversation_id.strip(),
                sender_id=sender_id,
                recipient_id=recipient_id,
                message_type=message_type.strip() or "event",
                payload=payload or {},
                priority=priority,
                status="pending",
                created_at=created_at.isoformat(),
                expires_at=(created_at + timedelta(seconds=effective_ttl)).isoformat(),
            )

            self._messages[message.message_id] = message
            self._order.append(message.message_id)
            self._inbox.setdefault(recipient_id, deque()).append(message.message_id)
            await self._prune_locked()
            return message

    async def get_message(self, message_id: str) -> ACPMessageRecord | None:
        async with self._lock:
            await self._prune_locked()
            return self._messages.get(message_id)

    async def fetch_inbox(self, *, agent_id: str, limit: int, include_acknowledged: bool = False) -> list[dict]:
        safe_limit = max(1, min(int(limit), 200))
        async with self._lock:
            await self._prune_locked()

            if agent_id not in self._agents:
                raise ValueError(f"agent '{agent_id}' is not registered")

            inbox = self._inbox.get(agent_id, deque())
            messages: list[dict] = []
            for message_id in reversed(inbox):
                message = self._messages.get(message_id)
                if message is None:
                    continue
                if not include_acknowledged and message.status == "acknowledged":
                    continue
                if message.status == "pending":
                    message.status = "delivered"
                    message.delivered_at = utc_now_iso()
                messages.append(message.model_dump())
                if len(messages) >= safe_limit:
                    break
            return messages

    async def acknowledge_message(self, *, agent_id: str, message_id: str) -> ACPMessageRecord:
        async with self._lock:
            await self._prune_locked()
            message = self._messages.get(message_id)
            if message is None:
                raise ValueError(f"message '{message_id}' not found")
            if message.recipient_id != agent_id:
                raise ValueError("only the recipient can acknowledge this message")

            message.status = "acknowledged"
            message.acknowledged_at = utc_now_iso()
            return message

    async def list_recent_messages(self, *, limit: int = 20, offset: int = 0) -> list[dict]:
        safe_limit = max(1, min(int(limit), 200))
        safe_offset = max(0, int(offset))
        async with self._lock:
            await self._prune_locked()
            selected: list[dict] = []
            skipped = 0
            for message_id in reversed(self._order):
                message = self._messages.get(message_id)
                if message is None:
                    continue
                if skipped < safe_offset:
                    skipped += 1
                    continue
                selected.append(message.model_dump())
                if len(selected) >= safe_limit:
                    break
            return selected

    async def stats(self) -> dict[str, int]:
        async with self._lock:
            await self._prune_locked()
            return {
                "registered_agents": len(self._agents),
                "total_messages": len(self._messages),
                "pending_messages": len([m for m in self._messages.values() if m.status == "pending"]),
                "delivered_messages": len([m for m in self._messages.values() if m.status == "delivered"]),
                "acknowledged_messages": len([m for m in self._messages.values() if m.status == "acknowledged"]),
            }

    async def _prune_locked(self) -> None:
        now = utc_now()
        expired_ids: set[str] = set()
        for message_id, message in self._messages.items():
            try:
                expires_at = datetime.fromisoformat(message.expires_at)
            except ValueError:
                expires_at = now
            if expires_at < now:
                expired_ids.add(message_id)

        for message_id in expired_ids:
            self._messages.pop(message_id, None)

        normalized_order: deque[str] = deque()
        seen: set[str] = set()
        for message_id in self._order:
            if message_id in seen:
                continue
            if message_id not in self._messages:
                continue
            seen.add(message_id)
            normalized_order.append(message_id)
        self._order = normalized_order

        for agent_id, queue in self._inbox.items():
            self._inbox[agent_id] = deque([msg_id for msg_id in queue if msg_id in self._messages])

        while len(self._order) > self.max_messages:
            stale_id = self._order.popleft()
            self._messages.pop(stale_id, None)
            for agent_id, queue in self._inbox.items():
                self._inbox[agent_id] = deque([msg_id for msg_id in queue if msg_id != stale_id])


# Backward-compatible alias used by tests/importers.
ACPStore = InMemoryACPStore

