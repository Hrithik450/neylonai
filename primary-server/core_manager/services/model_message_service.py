import json
import traceback
from django.core.cache import cache
from django.db import connection, transaction
from typing import List, Optional, Literal
from pydantic import BaseModel, ValidationError
from django.utils import timezone

# --- Schemas ---
class ChatMessage(BaseModel):
    id: str
    thread_id: str
    role: Literal["user", "assistant", "system"]
    file_url: Optional[str] = None
    content: str
    created_at: str

class NewChatMessage(BaseModel):
    thread_id: str
    role: str
    content: str
    file_url: Optional[str] = None

# --- Response wrappers ---
class ChatMessageResponse(BaseModel):
    success: bool
    data: ChatMessage | None = None
    error: str | None = None

class ChatMessagesResponse(BaseModel):
    success: bool
    data: Optional[List[ChatMessage]] = None
    error: str | None = None

# --- Service class ---
class ChatMessageService:

    @staticmethod
    def create_chat_message(data: NewChatMessage) -> ChatMessageResponse:
        """Insert a single chat message."""
        try:
            validated_data = NewChatMessage(**data)

            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("""
                        INSERT INTO thread_messages     
                        (thread_id, role, file_url, content, created_at)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id, thread_id, role, file_url, content, created_at;
                    """, [str(validated_data.thread_id), str(validated_data.role), validated_data.file_url, str(validated_data.content), timezone.now()])
                    row = cursor.fetchone()
            
            if not row:
                return ChatMessageResponse(success=False, data=None, error=f"Fatal: thread message not saved in DB")

            # Clear Redis cache
            cache_key_1 = f"thread:{validated_data.thread_id}:thread_messages"
            cache_key_2 = f"thread:{validated_data.thread_id}:recent_thread_messages"
            cache.delete(cache_key_1)
            cache.delete(cache_key_2)

            thread_messages_response = ChatMessage(id=str(row[0]), thread_id=str(row[1]), role=str(row[2]), file_url=row[3], content=str(row[4]), created_at=str(row[5].isoformat()))
            return ChatMessageResponse(success=True, data=thread_messages_response, error=None)

        except ValidationError as ve:
            return ChatMessageResponse(success=False, error=f"Validation error: {ve.errors()}")
        except Exception as e:
            return ChatMessageResponse(success=False, error=str(e))

    @staticmethod
    def list_recent_thread_messages(thread_id: str, limit: int = 8) -> ChatMessagesResponse:
        """Retrieve last N messages for a thread (with Redis cache)."""
        try:
            cache_key = f"thread:{thread_id}:recent_thread_messages"
            cached_value = cache.get(cache_key)
            if cached_value:
                # Deserialize cached data
                cached_data = json.loads(cached_value)
                # Convert each dict to ChatThreadMessage
                cached_thread_messages = [ChatMessage(**message) for message in cached_data]
                return ChatMessagesResponse(success=True, data=cached_thread_messages, error=None)

            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, thread_id, role, file_url, content, created_at
                        FROM thread_messages
                        WHERE thread_id = %s
                        ORDER BY created_at DESC
                        LIMIT %s;
                        """,
                        [str(thread_id), limit],
                    )
                    rows = cursor.fetchall()

            if not rows:
                return ChatMessagesResponse(success=True, data=[], error=f"Thread messages with id:{thread_id} do not exist")
            
            rows.reverse()
            response_messages = [
                ChatMessage(id=str(row[0]), thread_id=str(row[1]), role=str(row[2]), file_url=row[3], content=str(row[4]), created_at=str(row[5].isoformat())) for row in rows
            ]

            # Cache in Redis for 60 minutes
            cache.set(cache_key, json.dumps([tm.model_dump() for tm in response_messages]), timeout=3600)
            return ChatMessagesResponse(success=True, data=response_messages, error=None)

        except Exception as e:
            return ChatMessagesResponse(success=False, error=f"Error: {str(e)}, details: {traceback.format_exc()}")

    @staticmethod
    def list_thread_messages(thread_id: str) -> ChatMessagesResponse:
        """Retrieve last messages for a thread (with Redis cache)."""
        try:
            cache_key = f"thread:{thread_id}:thread_messages"
            cached_value = cache.get(cache_key)
            if cached_value:
                # Deserialize cached data
                cached_data = json.loads(cached_value)
                # Convert each dict to ChatThreadMessage
                cached_thread_messages = [ChatMessage(**message) for message in cached_data]
                return ChatMessagesResponse(success=True, data=cached_thread_messages, error=None)
            
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id, thread_id, role, file_url, content, created_at
                        FROM thread_messages
                        WHERE thread_id = %s
                        ORDER BY created_at ASC;
                        """,
                        [thread_id]
                    )
                    rows = cursor.fetchall()
            
            if not rows:
                return ChatMessagesResponse(success=True, data=[], error=f"Thread messages with id:{thread_id} do not exist")
            
            response_messages = [
                ChatMessage(id=str(row[0]), thread_id=str(row[1]), role=str(row[2]), file_url=row[3], content=str(row[4]), created_at=str(row[5].isoformat())) for row in rows
            ]

            cache.set(cache_key, json.dumps([tm.model_dump() for tm in response_messages]), timeout=3600)
            return ChatMessagesResponse(success=True, data=response_messages, error=None)
        
        except Exception as e:
            return ChatMessagesResponse(success=False, error=f"Error: {str(e)}, details: {traceback.format_exc()}")