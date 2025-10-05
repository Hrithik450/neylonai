import json
from django.core.cache import cache
from ...models import ThreadMessages
from typing import List, Optional, Literal
from pydantic import BaseModel, ValidationError

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
            validated = NewChatMessage(**data)
            thread_message = ThreadMessages.objects.create(
                thread_id=validated.thread_id,
                role=validated.role,
                content=validated.content
            )
            
            cache_key = f"thread:{validated.thread_id}:thread_messages"
            cache.delete(cache_key)

            response = ChatMessage(
                id=thread_message.id,
                thread_id=thread_message.thread_id,
                role=thread_message.role,
                content=thread_message.content,
                created_at=thread_message.created_at.isoformat()
            )

            return ChatMessageResponse(success=True, data=response, error=None)

        except ValidationError as ve:
            return ChatMessageResponse(success=False, error=f"Validation error: {ve}")
        except Exception as e:
            return ChatMessageResponse(success=False, error=str(e))

    @staticmethod
    def get_thread_messages(thread_id: int, limit: int | None = None) -> ChatMessagesResponse:
        """Retrieve last N messages for a thread (with Redis cache)."""
        try:
            cache_key = f"thread:{thread_id}:thread_messages"
            cached_value = cache.get(cache_key)
            if cached_value:
                # Deserialize cached data
                cached_data = json.loads(cached_value)
                # Convert each dict to ChatThreadMessage
                cached_thread_messages = [ChatMessage(**message) for message in cached_data]
                return ChatMessagesResponse(success=True, data=cached_thread_messages, error=None)

            thread_messages = ThreadMessages.objects.filter(thread_id=thread_id).order_by("created_at")
            if limit:
                thread_messages = thread_messages[:limit]

            response_messages = [
                ChatMessage(
                    id=tm.id,
                    thread_id=tm.thread_id,
                    role=tm.role,
                    content=tm.content,
                    created_at=tm.created_at.isoformat(),
                )
                for tm in thread_messages
            ]

            # Cache in Redis for 60 minutes
            cache.set(cache_key, json.dumps([tm.model_dump() for tm in response_messages]), timeout=3600)
            return ChatMessagesResponse(success=True, data=response_messages, error=None)

        except Exception as e:
            return ChatMessagesResponse(success=False, data=None, error=str(e))