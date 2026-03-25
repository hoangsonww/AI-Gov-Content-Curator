"""
Dead-letter queue for the SynthoraAI orchestration layer.

Articles that fail all recovery attempts are persisted in this queue
for later inspection, replay, or purge.  The queue is in-process only
(no external store); it is thread-safe via :class:`threading.Lock`.
"""
from __future__ import annotations

import threading
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Optional

import structlog

if TYPE_CHECKING:
    from .supervisor import ContentSupervisor

logger = structlog.get_logger(__name__)


def _utc_now() -> str:
    """Return the current UTC timestamp as an ISO-8601 string."""
    return datetime.now(timezone.utc).isoformat()


class DeadLetterEntry:
    """A single entry in the dead-letter queue.

    Args:
        entry_id: Unique identifier assigned at insertion time.
        article_id: Identifier of the article that failed.
        failure_reason: Human-readable description of the terminal failure.
        error_context: Arbitrary diagnostic context from the failing agent.
        original_payload: The article payload that was being processed.
        created_at: ISO-8601 timestamp of insertion.
        replay_count: How many times this entry has been replayed.
        last_replayed_at: ISO-8601 timestamp of the most recent replay attempt.
    """

    def __init__(
        self,
        article_id: str,
        failure_reason: str,
        error_context: Optional[dict[str, Any]] = None,
        original_payload: Optional[dict[str, Any]] = None,
    ) -> None:
        self.entry_id: str = str(uuid.uuid4())
        self.article_id: str = article_id
        self.failure_reason: str = failure_reason
        self.error_context: dict[str, Any] = error_context or {}
        self.original_payload: dict[str, Any] = original_payload or {}
        self.created_at: str = _utc_now()
        self.replay_count: int = 0
        self.last_replayed_at: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        """Serialise entry to a plain dictionary."""
        return {
            "entry_id": self.entry_id,
            "article_id": self.article_id,
            "failure_reason": self.failure_reason,
            "error_context": self.error_context,
            "original_payload": self.original_payload,
            "created_at": self.created_at,
            "replay_count": self.replay_count,
            "last_replayed_at": self.last_replayed_at,
        }


class DeadLetterQueue:
    """Thread-safe in-process dead-letter queue.

    Example::

        dlq = DeadLetterQueue()
        entry_id = dlq.add(
            article_id="art-123",
            failure_reason="max_iterations_exceeded",
            original_payload={"content": "..."},
        )
        entry = dlq.get(entry_id)
        result = await dlq.replay(entry_id, supervisor=supervisor)
        dlq.purge()
    """

    def __init__(self) -> None:
        self._entries: dict[str, DeadLetterEntry] = {}
        self._lock: threading.Lock = threading.Lock()

    # ------------------------------------------------------------------
    # Mutation helpers
    # ------------------------------------------------------------------

    def add(
        self,
        article_id: str,
        failure_reason: str,
        error_context: Optional[dict[str, Any]] = None,
        original_payload: Optional[dict[str, Any]] = None,
    ) -> str:
        """Insert a failed article into the dead-letter queue.

        Args:
            article_id: Identifier of the failed article.
            failure_reason: Human-readable reason for terminal failure.
            error_context: Optional diagnostic context from the last error.
            original_payload: The article payload dict that was being processed.

        Returns:
            The ``entry_id`` of the newly created entry.
        """
        entry = DeadLetterEntry(
            article_id=article_id,
            failure_reason=failure_reason,
            error_context=error_context,
            original_payload=original_payload,
        )
        with self._lock:
            self._entries[entry.entry_id] = entry

        logger.warning(
            "dead_letter_queue.added",
            entry_id=entry.entry_id,
            article_id=article_id,
            failure_reason=failure_reason,
        )
        return entry.entry_id

    def purge(self) -> int:
        """Remove all entries from the queue.

        Returns:
            Number of entries removed.
        """
        with self._lock:
            count = len(self._entries)
            self._entries.clear()

        logger.info("dead_letter_queue.purged", removed=count)
        return count

    # ------------------------------------------------------------------
    # Read helpers
    # ------------------------------------------------------------------

    def list_all(self) -> list[dict[str, Any]]:
        """Return all entries as a list of dictionaries.

        Returns:
            Snapshot of all dead-letter entries, ordered by insertion.
        """
        with self._lock:
            return [entry.to_dict() for entry in self._entries.values()]

    def get(self, entry_id: str) -> Optional[dict[str, Any]]:
        """Retrieve a single entry by its identifier.

        Args:
            entry_id: UUID string assigned at insertion.

        Returns:
            Entry dictionary or ``None`` if not found.
        """
        with self._lock:
            entry = self._entries.get(entry_id)
            return entry.to_dict() if entry is not None else None

    def stats(self) -> dict[str, Any]:
        """Return aggregate statistics about the queue.

        Returns:
            Dictionary with ``total``, ``replay_pending`` (entries with
            ``replay_count == 0``), ``replayed`` (entries replayed at least
            once), and ``oldest_created_at``.
        """
        with self._lock:
            entries = list(self._entries.values())

        total = len(entries)
        replayed = sum(1 for e in entries if e.replay_count > 0)
        oldest = min((e.created_at for e in entries), default=None)

        return {
            "total": total,
            "replay_pending": total - replayed,
            "replayed": replayed,
            "oldest_created_at": oldest,
        }

    # ------------------------------------------------------------------
    # Replay
    # ------------------------------------------------------------------

    async def replay(
        self,
        entry_id: str,
        supervisor: ContentSupervisor,
        mode: str = "full",
    ) -> dict[str, Any]:
        """Replay a dead-letter entry through the supervisor pipeline.

        Args:
            entry_id: The entry to replay.
            supervisor: A :class:`~agentic_ai.orchestration.supervisor.ContentSupervisor`
                instance that will process the article.
            mode: Processing mode to use for replay (default ``"full"``).

        Returns:
            Dictionary with ``entry_id``, ``article_id``, ``success``,
            ``result`` (on success) or ``error`` (on failure), and
            ``replay_count`` after this attempt.

        Raises:
            KeyError: If ``entry_id`` is not found in the queue.
        """
        with self._lock:
            entry = self._entries.get(entry_id)
            if entry is None:
                raise KeyError(f"Dead-letter entry not found: {entry_id!r}")

        logger.info(
            "dead_letter_queue.replay_start",
            entry_id=entry_id,
            article_id=entry.article_id,
            replay_count=entry.replay_count,
        )

        try:
            result = await supervisor.process_article(entry.original_payload, mode=mode)
            success = True
            error_msg = None
        except Exception as exc:
            result = {}
            success = False
            error_msg = str(exc)
            logger.exception(
                "dead_letter_queue.replay_failed",
                entry_id=entry_id,
                article_id=entry.article_id,
                error=error_msg,
            )

        with self._lock:
            entry.replay_count += 1
            entry.last_replayed_at = _utc_now()

        logger.info(
            "dead_letter_queue.replay_complete",
            entry_id=entry_id,
            article_id=entry.article_id,
            success=success,
            replay_count=entry.replay_count,
        )

        response: dict[str, Any] = {
            "entry_id": entry_id,
            "article_id": entry.article_id,
            "success": success,
            "replay_count": entry.replay_count,
        }
        if success:
            response["result"] = result
        else:
            response["error"] = error_msg
        return response
