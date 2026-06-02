import json

from django.utils import timezone
from django.core.cache import cache
from django.db import connection, transaction


# --- Service class ---
class ThreadMessageService:

    @staticmethod
    def create_thead_message(data):
        """Insert a single  message."""
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO thread_messages     
                        (thread_id, role, content, created_at)
                        VALUES (%s, %s, %s, %s)
                        RETURNING id, thread_id, role, content, created_at;
                    """,
                        [
                            str(data["thread_id"]),
                            str(data["role"]),
                            data["content"],
                            timezone.now(),
                        ],
                    )
                    row = cursor.fetchone()

            if not row:
                return {
                    "success": False,
                    "error": "Fatal: thread message not saved in DB",
                }

            cache.delete(f"thread:{data['thread_id']}:thread_messages")
            cache.delete(f"thread:{data['thread_id']}:recent_thread_messages")

            return {
                "success": True,
                "data": {
                    "id": str(row[0]),
                    "thread_id": str(row[1]),
                    "role": row[2],
                    "content": row[3],
                    "created_at": row[4].isoformat(),
                },
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    @staticmethod
    def list_recent_thread_messages(thread_id: str, limit: int = 8):
        """Retrieve last N messages for a thread (with Redis cache)."""
        try:
            cache_key = f"thread:{thread_id}:recent_thread_messages"

            cached_value = cache.get(cache_key)
            if cached_value:
                return {
                    "success": True,
                    "data": json.loads(cached_value),
                }

            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, thread_id, role, content, created_at
                        FROM thread_messages
                        WHERE thread_id = %s
                        ORDER BY created_at DESC
                        LIMIT %s;
                        """,
                        [str(thread_id), limit],
                    )
                    rows = cursor.fetchall()

            if not rows:
                return {
                    "success": True,
                    "data": [],
                    "error": f"Thread messages with id:{thread_id} do not exist",
                }

            rows.reverse()
            messages = [
                {
                    "id": str(row[0]),
                    "thread_id": str(row[1]),
                    "role": row[2],
                    "content": row[3],
                    "created_at": row[4].isoformat(),
                }
                for row in rows
            ]

            cache.set(
                cache_key,
                json.dumps(messages),
                timeout=3600,
            )

            return {
                "success": True,
                "data": messages,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    @staticmethod
    def list_thread_messages(thread_id: str):
        """Retrieve last messages for a thread (with Redis cache)."""
        try:
            cache_key = f"thread:{thread_id}:thread_messages"

            cached_value = cache.get(cache_key)
            if cached_value:
                return {
                    "success": True,
                    "data": json.loads(cached_value),
                }

            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, thread_id, role, content, created_at
                        FROM thread_messages
                        WHERE thread_id = %s
                        ORDER BY created_at ASC;
                        """,
                        [str(thread_id)],
                    )
                    rows = cursor.fetchall()

            if not rows:
                return {
                    "success": True,
                    "data": [],
                }

            messages = [
                {
                    "id": str(row[0]),
                    "thread_id": str(row[1]),
                    "role": row[2],
                    "content": row[3],
                    "created_at": row[4].isoformat(),
                }
                for row in rows
            ]

            cache.set(
                cache_key,
                json.dumps(messages),
                timeout=3600,
            )

            return {
                "success": True,
                "data": messages,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }
