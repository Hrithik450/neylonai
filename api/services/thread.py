import json
from django.utils import timezone
from django.core.cache import cache
from django.db import transaction, connection


class ThreadService:

    @staticmethod
    def create_thread(data):
        """Insert a single chat thread."""
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO "thread"     
                        (title, user_id, created_at)
                        VALUES (%s, %s, %s)
                        RETURNING id, user_id, title, created_at;
                    """,
                        [str(data["title"]), str(data["user_id"]), timezone.now()],
                    )
                    row = cursor.fetchone()

            if not row:
                return {
                    "success": False,
                    "error": "Thread could not be created",
                }

            cache.delete(f"user:{data['user_id']}:user_threads")

            return {
                "success": True,
                "data": {
                    "id": str(row[0]),
                    "user": str(row[1]),
                    "title": row[2],
                    "created_at": row[3].isoformat(),
                },
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    @staticmethod
    def update_thread(thread_id: str, data):
        try:
            if not data:
                return {
                    "success": False,
                    "error": "No fields to update",
                }

            params = []
            set_clauses = []
            for field, value in data.items():
                set_clauses.append(f'"{field}" = %s')
                params.append(value)

            params.append(thread_id)

            sql = f"""
                UPDATE "thread"
                SET {', '.join(set_clauses)}
                WHERE id = %s
                RETURNING id, user_id, title, created_at;
            """

            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(sql, params)
                    row = cursor.fetchone()

            if not row:
                return {
                    "success": False,
                    "error": f"Thread {thread_id} not found",
                }

            cache.delete(f"thread:{thread_id}:user_thread")

            return {
                "success": True,
                "data": {
                    "id": str(row[0]),
                    "user_id": str(row[1]),
                    "title": row[2],
                    "created_at": row[3].isoformat(),
                },
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    @staticmethod
    def get_thread_by_id(thread_id: str):
        """
        Retrieve a single ChatThread by ID with cache support.
        """
        try:

            cache_key = f"thread:{thread_id}:user_thread"

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
                        SELECT id, user_id, title, created_at
                        FROM "thread"
                        WHERE id = %s
                        LIMIT 1;
                    """,
                        [str(thread_id)],
                    )
                    row = cursor.fetchone()

            if not row:
                return {
                    "success": False,
                    "error": f"Thread {thread_id} not found",
                }

            thread = {
                "id": str(row[0]),
                "user": str(row[1]),
                "title": row[2],
                "created_at": row[3].isoformat(),
            }

            cache.set(
                cache_key,
                json.dumps(thread),
                timeout=3600,
            )

            return {
                "success": True,
                "data": thread,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }

    @staticmethod
    def list_threads(user_id: str):
        """
        List all chat threads for a given user with caching support.
        """
        try:
            cache_key = f"user:{user_id}:user_threads"

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
                        SELECT id, user_id, title, created_at
                        FROM "thread"
                        WHERE user_id = %s
                        ORDER BY created_at DESC;
                        """,
                        [str(user_id)],
                    )
                    rows = cursor.fetchall()

            threads = [
                {
                    "id": str(row[0]),
                    "user": str(row[1]),
                    "title": row[2],
                    "created_at": row[3].isoformat(),
                }
                for row in rows
            ]

            cache.set(
                cache_key,
                json.dumps(threads),
                timeout=3600,
            )
            return {
                "success": True,
                "data": threads,
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
            }
