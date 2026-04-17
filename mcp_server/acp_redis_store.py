"""Redis-backed ACP registry and inter-agent message store."""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from .acp_models import ACPAgentRecord, ACPMessageRecord
from .utils import utc_now, utc_now_iso


class RedisACPStore:
    """Redis ACP store suitable for multi-replica production deployments."""

    def __init__(
        self,
        *,
        redis_client: Any,
        key_prefix: str,
        max_agents: int,
        max_messages: int,
        default_message_ttl_seconds: int,
        agent_ttl_seconds: int,
    ):
        self.redis = redis_client
        self.prefix = key_prefix.rstrip(":")
        self.max_agents = max_agents
        self.max_messages = max_messages
        self.default_message_ttl_seconds = default_message_ttl_seconds
        self.agent_ttl_seconds = agent_ttl_seconds

    def _key(self, suffix: str) -> str:
        return f"{self.prefix}:{suffix}"

    async def register_agent(
        self,
        *,
        agent_id: str,
        display_name: str = "",
        capabilities: list[str] | None = None,
        metadata: dict | None = None,
    ) -> ACPAgentRecord:
        await self._prune()
        agents_key = self._key("agents")
        existing_raw = await self.redis.hget(agents_key, agent_id)
        if existing_raw is None:
            current = await self.redis.hlen(agents_key)
            if current >= self.max_agents:
                raise ValueError(f"max registered agents exceeded ({self.max_agents})")
            registered_at = utc_now_iso()
        else:
            existing_data = json.loads(existing_raw)
            registered_at = existing_data.get("registered_at", utc_now_iso())

        now_iso = utc_now_iso()
        record = ACPAgentRecord(
            agent_id=agent_id,
            display_name=display_name.strip(),
            capabilities=(capabilities or []),
            metadata=(metadata or {}),
            status="active",
            registered_at=registered_at,
            last_heartbeat_at=now_iso,
        )
        now_score = utc_now().timestamp()
        heartbeat_key = self._key("agents:heartbeat")
        await self.redis.hset(agents_key, agent_id, json.dumps(record.model_dump()))
        await self.redis.zadd(heartbeat_key, {agent_id: now_score})
        return record

    async def unregister_agent(self, agent_id: str) -> bool:
        agents_key = self._key("agents")
        heartbeat_key = self._key("agents:heartbeat")
        deleted = await self.redis.hdel(agents_key, agent_id)
        await self.redis.zrem(heartbeat_key, agent_id)
        return bool(deleted)

    async def heartbeat(self, agent_id: str) -> ACPAgentRecord | None:
        agents_key = self._key("agents")
        raw = await self.redis.hget(agents_key, agent_id)
        if raw is None:
            return None
        data = json.loads(raw)
        data["last_heartbeat_at"] = utc_now_iso()
        record = ACPAgentRecord(**data)
        await self.redis.hset(agents_key, agent_id, json.dumps(record.model_dump()))
        await self.redis.zadd(self._key("agents:heartbeat"), {agent_id: utc_now().timestamp()})
        return record

    async def list_agents(self) -> list[dict]:
        await self._prune()
        raw_map = await self.redis.hgetall(self._key("agents"))
        agents: list[dict] = []
        for raw in raw_map.values():
            agents.append(json.loads(raw))
        return agents

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
        await self._prune()
        agents_key = self._key("agents")
        if not await self.redis.hexists(agents_key, sender_id):
            raise ValueError(f"sender agent '{sender_id}' is not registered")
        if not await self.redis.hexists(agents_key, recipient_id):
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

        messages_key = self._key("messages")
        order_key = self._key("messages:order")
        inbox_key = self._key(f"inbox:{recipient_id}")
        score = created_at.timestamp()
        await self.redis.hset(messages_key, message.message_id, json.dumps(message.model_dump()))
        await self.redis.zadd(order_key, {message.message_id: score})
        await self.redis.zadd(inbox_key, {message.message_id: score})
        await self._prune()
        return message

    async def get_message(self, message_id: str) -> ACPMessageRecord | None:
        await self._prune()
        raw = await self.redis.hget(self._key("messages"), message_id)
        if raw is None:
            return None
        return ACPMessageRecord(**json.loads(raw))

    async def fetch_inbox(self, *, agent_id: str, limit: int, include_acknowledged: bool = False) -> list[dict]:
        await self._prune()
        if not await self.redis.hexists(self._key("agents"), agent_id):
            raise ValueError(f"agent '{agent_id}' is not registered")
        safe_limit = max(1, min(int(limit), 200))
        inbox_key = self._key(f"inbox:{agent_id}")
        messages_hash = self._key("messages")
        message_ids = await self.redis.zrevrange(inbox_key, 0, safe_limit * 2)
        out: list[dict] = []
        for message_id in message_ids:
            raw = await self.redis.hget(messages_hash, message_id)
            if raw is None:
                await self.redis.zrem(inbox_key, message_id)
                continue
            message = ACPMessageRecord(**json.loads(raw))
            if message.status == "acknowledged" and not include_acknowledged:
                continue
            if message.status == "pending":
                message.status = "delivered"
                message.delivered_at = utc_now_iso()
                await self.redis.hset(messages_hash, message.message_id, json.dumps(message.model_dump()))
            out.append(message.model_dump())
            if len(out) >= safe_limit:
                break
        return out

    async def acknowledge_message(self, *, agent_id: str, message_id: str) -> ACPMessageRecord:
        await self._prune()
        messages_key = self._key("messages")
        raw = await self.redis.hget(messages_key, message_id)
        if raw is None:
            raise ValueError(f"message '{message_id}' not found")
        message = ACPMessageRecord(**json.loads(raw))
        if message.recipient_id != agent_id:
            raise ValueError("only the recipient can acknowledge this message")
        message.status = "acknowledged"
        message.acknowledged_at = utc_now_iso()
        await self.redis.hset(messages_key, message.message_id, json.dumps(message.model_dump()))
        return message

    async def list_recent_messages(self, *, limit: int = 20, offset: int = 0) -> list[dict]:
        await self._prune()
        safe_limit = max(1, min(int(limit), 200))
        safe_offset = max(0, int(offset))
        order_key = self._key("messages:order")
        messages_hash = self._key("messages")
        ids = await self.redis.zrevrange(order_key, safe_offset, safe_offset + safe_limit - 1)
        out: list[dict] = []
        for message_id in ids:
            raw = await self.redis.hget(messages_hash, message_id)
            if raw is None:
                await self.redis.zrem(order_key, message_id)
                continue
            out.append(json.loads(raw))
        return out

    async def stats(self) -> dict[str, int]:
        await self._prune()
        agents = await self.redis.hlen(self._key("agents"))
        raw_messages = await self.redis.hvals(self._key("messages"))
        pending = 0
        delivered = 0
        acknowledged = 0
        for raw in raw_messages:
            message = json.loads(raw)
            status = message.get("status")
            if status == "pending":
                pending += 1
            elif status == "delivered":
                delivered += 1
            elif status == "acknowledged":
                acknowledged += 1
        return {
            "registered_agents": agents,
            "total_messages": len(raw_messages),
            "pending_messages": pending,
            "delivered_messages": delivered,
            "acknowledged_messages": acknowledged,
        }

    async def _prune(self) -> None:
        now = utc_now()
        now_score = now.timestamp()
        messages_key = self._key("messages")
        order_key = self._key("messages:order")

        # Remove expired messages first.
        expired_ids: list[str] = []
        raw_messages = await self.redis.hgetall(messages_key)
        for message_id, raw in raw_messages.items():
            message = json.loads(raw)
            try:
                expires_at = datetime.fromisoformat(message.get("expires_at", ""))
            except ValueError:
                expires_at = now
            if expires_at < now:
                expired_ids.append(message_id)
        if expired_ids:
            await self.redis.hdel(messages_key, *expired_ids)
            await self.redis.zrem(order_key, *expired_ids)

        # Enforce max message history by dropping oldest.
        total_messages = await self.redis.zcard(order_key)
        if total_messages > self.max_messages:
            trim_count = total_messages - self.max_messages
            stale_ids = await self.redis.zrange(order_key, 0, trim_count - 1)
            if stale_ids:
                await self.redis.hdel(messages_key, *stale_ids)
                await self.redis.zrem(order_key, *stale_ids)
                inbox_keys = await self.redis.keys(self._key("inbox:*"))
                if inbox_keys:
                    for inbox_key in inbox_keys:
                        await self.redis.zrem(inbox_key, *stale_ids)

        # Prune stale agents by heartbeat age.
        if self.agent_ttl_seconds > 0:
            stale_before = now_score - self.agent_ttl_seconds
            stale_agents = await self.redis.zrangebyscore(self._key("agents:heartbeat"), "-inf", stale_before)
            if stale_agents:
                await self.redis.hdel(self._key("agents"), *stale_agents)
                await self.redis.zrem(self._key("agents:heartbeat"), *stale_agents)

