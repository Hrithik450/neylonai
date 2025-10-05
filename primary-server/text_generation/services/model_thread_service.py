import json
from ..models import Thread
from typing import List, Optional
from django.core.cache import cache
from .model_message_service import ChatMessage
from pydantic import BaseModel, ValidationError

# --- Schema (like zod schema) ---
class ChatThread(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: str
    messages: Optional[List[ChatMessage]] = None

class NewChatThread(BaseModel):
    user_id: Optional[str] = None
    title: Optional[str] = None

# --- Response wrappers ---
class ChatThreadResponse(BaseModel):
    success: bool
    data: Optional[ChatThread] = None
    error: str | None = None

class ChatThreadsResponse(BaseModel):
    success: bool
    data: Optional[List[ChatThread]] = None
    error: str | None = None

# --- Service class ---
class ChatThreadService:
    
    @staticmethod
    def create_chat_thread(data: NewChatThread) -> ChatThreadResponse:
        """Insert a single chat thread."""
        try:
            # Validate input (equivalent to zod.parse)
            validated_data = data.model_dump(exclude_unset=True)
            print(validated_data, "validated dta")

            if not validated_data:
                return ChatThreadResponse(success=False, error="No fields are there create thread")
            
            thread = Thread.objects.create(
                title=validated_data['title'],
                user_id=validated_data['user_id']
            )

            # Clear Redis cache for user’s last thread
            cache_key = f"user:{validated_data['user_id']}:user_threads"
            cache.delete(cache_key)

            response_thread = ChatThread(
                id=str(thread.id),
                title=str(thread.title),
                created_at=str(thread.created_at),
                user_id=str(thread.user_id)
            )

            return ChatThreadResponse(success=True, data=response_thread, error=None)
        
        except ValidationError as ve:
            return ChatThreadResponse(success=False, error=f"Validation error: {ve}")
        except Exception as e:
            return ChatThreadResponse(success=False, error=str(e))
    
    @staticmethod
    def update_chat_thread(thread_id: str, data: NewChatThread) -> ChatThreadResponse:
        try:
            # Validate partial data (like zod.partial())
            validated_data = data.model_dump(exclude_unset=True)

            if not validated_data:
                return ChatThreadResponse(success=False, error="No fields to update")

            # Get the thread instance
            try:
                thread = Thread.objects.get(id=thread_id)
            except Thread.DoesNotExist:
                return ChatThreadResponse(success=False, data=None, error="ChatThread not found")
            
            # Apply partial updates dynamically
            for field, value in validated_data.items():
                setattr(thread, field, value)

            # Save only the updated fields
            thread.save(update_fields=list(validated_data.keys()))

            # Clear cache if needed
            cache_key = f"thread:{thread_id}:user_thread"
            cache.delete(cache_key)

            # Return updated thread as Pydantic model
            response_thread = ChatThread(
                id=str(thread.id),
                user_id=str(thread.user_id),
                title=str(thread.title),
                created_at=str(thread.created_at)
            )
            return ChatThreadResponse(success=True, data=response_thread, error=None)
            
        except ValidationError as ve:
            return ChatThreadResponse(success=False, error=f"Validation error: {ve}")
        except Exception as e:
            return ChatThreadResponse(success=False, error=str(e))
        
    @staticmethod
    def get_chat_thread_by_id(thread_id: str) -> ChatThreadResponse:
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
                cached_thread = ChatThread(**cached_data)
                return ChatThreadResponse(success=True, data=cached_thread, error=None)
            
            # Retrieve thread from DB
            try:
                thread_obj = Thread.objects.get(id=thread_id)
            except Thread.DoesNotExist:
                return ChatThreadResponse(success=False, error="ChatThread not found")
            
            # Build response
            response_thread = ChatThread(
                id=str(thread_obj.id),
                user_id=str(thread_obj.user_id),
                title=str(thread_obj.title),
                created_at=str(thread_obj.created_at)
            )

            # Cache the serialized dict for future
            cache.set(cache_key, json.dumps(response_thread.model_dump()), timeout=3600)
            return ChatThreadResponse(success=True, data=response_thread, error=None)
        
        except Exception as e:
            return ChatThreadResponse(success=False, error=str(e))
        
    @staticmethod
    def list_chat_threads(user_id: str) -> ChatThreadsResponse:
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
                cached_threads = [ChatThread(**thread) for thread in cached_data]
                return ChatThreadsResponse(success=True, data=cached_threads, error=None)
            
            # Retrieve threads from DB
            thread_objs = Thread.objects.filter(user_id=user_id).order_by('created_at')

            response_threads = [
                ChatThread(
                    id=str(thread.id),
                    user_id=str(thread.user_id),
                    title=str(thread.title),
                    created_at=str(thread.created_at)
                )
                for thread in thread_objs
            ]

            # Cache the list of thread dicts for 1 hour
            cache.set(cache_key, json.dumps([t.model_dump() for t in response_threads]), timeout=3600)
            return ChatThreadsResponse(success=True, data=response_threads, error=None)

        except Exception as e:
            return ChatThreadsResponse(success=False, error=str(e))