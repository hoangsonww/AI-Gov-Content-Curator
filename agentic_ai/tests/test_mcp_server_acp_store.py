from __future__ import annotations

import pytest

from mcp_server.acp_store import ACPStore


@pytest.mark.asyncio
async def test_acp_register_send_fetch_and_ack() -> None:
    store = ACPStore(max_agents=10, max_messages=100, default_message_ttl_seconds=3600)

    await store.register_agent(agent_id="agent-a", capabilities=["analyze"])
    await store.register_agent(agent_id="agent-b", capabilities=["summarize"])

    message = await store.send_message(
        sender_id="agent-a",
        recipient_id="agent-b",
        payload={"job_id": "j-1", "task": "summarize"},
        message_type="task",
        conversation_id="conv-1",
        priority=7,
    )

    inbox = await store.fetch_inbox(agent_id="agent-b", limit=10)
    assert len(inbox) == 1
    assert inbox[0]["message_id"] == message.message_id
    assert inbox[0]["status"] == "delivered"

    acked = await store.acknowledge_message(agent_id="agent-b", message_id=message.message_id)
    assert acked.status == "acknowledged"
    assert acked.acknowledged_at is not None

    filtered_inbox = await store.fetch_inbox(agent_id="agent-b", limit=10, include_acknowledged=False)
    assert filtered_inbox == []


@pytest.mark.asyncio
async def test_acp_send_requires_registered_agents() -> None:
    store = ACPStore(max_agents=5, max_messages=20, default_message_ttl_seconds=60)
    await store.register_agent(agent_id="agent-a")

    with pytest.raises(ValueError):
        await store.send_message(
            sender_id="agent-a",
            recipient_id="agent-missing",
            payload={"msg": "hello"},
        )
