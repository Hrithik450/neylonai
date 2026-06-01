import json
from django.db import transaction, connection
from typing import List, Optional
from django.core.cache import cache
from .message_service import ThreadMessage
from pydantic import BaseModel, ValidationError


class Thread(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: str
    messages: Optional[List[ThreadMessage]] = None


class NewThread(BaseModel):
    user_id: Optional[str] = None
    title: Optional[str] = None


class ThreadResponse(BaseModel):
    success: bool
    data: Optional[Thread] = None
    error: str | None = None


class ThreadsResponse(BaseModel):
    success: bool
    data: Optional[List[Thread]] = None
    error: str | None = None


# --- Service class ---
class ThreadService:

    @staticmethod
    def create_thread(data: NewThread) -> ThreadResponse:
        """Insert a single chat thread."""
        try:
            # Validate input (equivalent to zod.parse)
            validated_data = NewThread(**data).model_dump(exclude_unset=True)

            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO "thread"     
                        (title, user_id)
                        VALUES (%s, %s)
                        RETURNING id, user_id, title, created_at;
                    """,
                        [str(validated_data["title"]), str(validated_data["user_id"])],
                    )
                    row = cursor.fetchone()

            if not row:
                return ThreadResponse(
                    success=False, error=f"Error occured, thread could not be created."
                )

            # Clear Redis cache for user’s last thread
            cache_key = f"user:{validated_data['user_id']}:user_threads"
            cache.delete(cache_key)

            thread_response = Thread(
                id=str(row[0]),
                user_id=str(row[1]),
                title=str(row[2]),
                created_at=str(row[3].isoformat()),
            )
            return ThreadResponse(success=True, data=thread_response, error=None)

        except ValidationError as ve:
            return ThreadResponse(
                success=False, error=f"Validation error: {ve.errors()}"
            )
        except Exception as e:
            return ThreadResponse(success=False, error=str(e))

    @staticmethod
    def update_thread(thread_id: str, data: NewThread) -> ThreadResponse:
        try:
            # Validate partial data (like zod.partial())
            validated_data = NewThread(**data).model_dump(exclude_unset=True)
            if not validated_data:
                return ThreadResponse(
                    success=False, data=None, error="No fields to update"
                )

            params = []
            set_clauses = []
            for field, value in validated_data.items():
                set_clauses.append(f'"{field}" = %s')
                params.append(value)

            params.append(thread_id)

            sql = f"""
                UPDATE "thread"
                SET {', '.join(set_clauses)}
                WHERE id = %s
                RETURNING id, user_id, title, created_at;
            """

            # Get the thread instance
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(sql, params)
                    row = cursor.fetchone()

            if not row:
                return ThreadResponse(
                    success=False, data=None, error=f"Thread {thread_id} not found"
                )

            # Clear cache if needed
            cache_key = f"thread:{thread_id}:user_thread"
            cache.delete(cache_key)

            # Return updated thread as Pydantic model
            thread_response = NewThread(
                id=str(row[0]),
                user_id=str(row[1]),
                title=str(row[2]),
                created_at=str(row[3].isoformat()),
            )
            return ThreadResponse(success=True, data=thread_response, error=None)

        except ValidationError as ve:
            return ThreadResponse(
                success=False, error=f"Validation error: {ve.errors()}"
            )
        except Exception as e:
            return ThreadResponse(success=False, error=str(e))

    @staticmethod
    def get_thread_by_id(thread_id: str) -> ThreadResponse:
        """
        Retrieve a single ChatThread by ID with cache support.
        """
        try:
            # Check Redis cache first
            cache_key = f"thread:{thread_id}:user_thread"
            cached_value = cache.get(cache_key)
            if cached_value:
                # Deserialize cached data
                cached_data = json.loads(cached_value)
                # Convert dict to ChatThread
                cached_thread = Thread(**cached_data)
                return ThreadResponse(success=True, data=cached_thread, error=None)

            # Retrieve thread from DB
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
                return ThreadResponse(
                    success=False, data=None, error=f"Thread {thread_id} not found"
                )

            # Build response
            thread_response = Thread(
                id=str(row[0]),
                user_id=str(row[1]),
                title=str(row[2]),
                created_at=str(row[3].isoformat()),
            )

            # Cache the serialized dict for future
            cache.set(cache_key, json.dumps(thread_response.model_dump()), timeout=3600)
            return ThreadResponse(success=True, data=thread_response, error=None)

        except Exception as e:
            return ThreadResponse(success=False, error=str(e))

    @staticmethod
    def list_threads(user_id: str) -> ThreadsResponse:
        """
        List all chat threads for a given user with caching support.
        """
        try:
            cache_key = f"user:{user_id}:user_threads"
            cached_value = cache.get(cache_key)
            if cached_value:
                # Deserialize cached data
                cached_data = json.loads(cached_value)
                # Convert each dict to ChatThread
                cached_threads = [Thread(**thread) for thread in cached_data]
                return ThreadsResponse(success=True, data=cached_threads, error=None)

            # Retrieve threads from DB
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

            response_threads = [
                Thread(
                    id=str(row[0]),
                    user_id=str(row[1]),
                    title=str(row[2]),
                    created_at=str(row[3].isoformat()),
                )
                for row in rows
            ]

            # Cache the list of thread dicts for 1 hour
            cache.set(
                cache_key,
                json.dumps([t.model_dump() for t in response_threads]),
                timeout=3600,
            )
            return ThreadsResponse(success=True, data=response_threads, error=None)

        except Exception as e:
            return ThreadsResponse(success=False, error=str(e))
