import json
import traceback
from django.core.cache import cache
from ..models import ThreadMessages
from typing import List, Optional, Literal
from pydantic import BaseModel, ValidationError
from django.utils import timezone

# --- Schemas ---
class ChatMessage(BaseModel):
    id: str
    thread_id: str
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: str

class NewChatMessage(BaseModel):
    thread_id: str
    role: str
    content: str

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
            
            thread_message = ThreadMessages.objects.create(
                thread_id=str(validated_data.thread_id),
                role=str(validated_data.role),
                content=str(validated_data.content),
                created_at=timezone.now()
            )
            
            if not thread_message:
                return ChatMessageResponse(success=False, data=None, error=f"Fatal: thread message not saved in DB")

            # Clear Redis cache
            cache_key_1 = f"thread:{validated_data.thread_id}:thread_messages"
            cache_key_2 = f"thread:{validated_data.thread_id}:recent_thread_messages"
            cache.delete(cache_key_1)
            cache.delete(cache_key_2)

            thread_messages_response = ChatMessage(
                id=str(thread_message.id),
                thread_id=str(thread_message.thread_id),
                role=str(thread_message.role),
                content=str(thread_message.content),
                created_at=str(thread_message.created_at.isoformat())
            )

            return ChatMessageResponse(success=True, data=thread_messages_response, error=None)

        except ValidationError as ve:
            return ChatMessageResponse(success=False, error=f"Validation error: {ve.errors()}")
        except Exception as e:
            return ChatMessageResponse(success=False, error=str(e))

    @staticmethod
    def list_recent_thread_messages(thread_id: str, limit: int = 10) -> ChatMessagesResponse:
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

            thread_messages = (ThreadMessages.objects.filter(thread_id=thread_id).order_by("created_at")[:limit])

            response_messages = [
                ChatMessage(
                    id=str(tm.id),
                    thread_id=str(tm.thread_id),
                    role=str(tm.role),
                    content=str(tm.content),
                    created_at=str(tm.created_at.isoformat()),
                )
                for tm in thread_messages
            ]

            # Cache in Redis for 60 minutes
            cache.set(cache_key, json.dumps([tm.model_dump() for tm in response_messages]), timeout=3600)
            return ChatMessagesResponse(success=True, data=response_messages, error=None)

        except ThreadMessages.DoesNotExist:
            return ChatMessagesResponse(success=False, data=None, error=f"Thread messages with id:{thread_id} does not exist")
        except Exception as e:
            return ChatMessagesResponse(success=False, error=f"Error: {str(e)}, details: {traceback.format_exc()}")

    @staticmethod
    def list_thread_messages(thread_id: str) -> ChatMessagesResponse:
        """Retrieve last messages for a thread (with Redis cache)."""
        try:
            cache_key = f"thread:{thread_id}:thread_messages"
            cache.delete(cache_key)
            cached_value = cache.get(cache_key)
            if cached_value:
                # Deserialize cached data
                cached_data = json.loads(cached_value)
                # Convert each dict to ChatThreadMessage
                cached_thread_messages = [ChatMessage(**message) for message in cached_data]
                return ChatMessagesResponse(success=True, data=cached_thread_messages, error=None)
            
            thread_messages = (ThreadMessages.objects.filter(thread_id=thread_id).order_by("created_at"))

            response_messages = [
                ChatMessage(
                    id=str(tm.id),
                    thread_id=str(tm.thread_id),
                    role=str(tm.role),
                    content=str(tm.content),
                    created_at=str(tm.created_at.isoformat()),
                )
                for tm in thread_messages
            ]
            
            cache.set(cache_key, json.dumps([tm.model_dump() for tm in response_messages]), timeout=3600)
            return ChatMessagesResponse(success=True, data=response_messages, error=None)
        
        except ThreadMessages.DoesNotExist:
            return ChatMessagesResponse(success=False, data=None, error=f"Thread messages with id:{thread_id} does not exist")
        except Exception as e:
            return ChatMessagesResponse(success=False, error=f"Error: {str(e)}, details: {traceback.format_exc()}")