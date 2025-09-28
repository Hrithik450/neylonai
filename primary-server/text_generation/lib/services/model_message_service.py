import json
from pydantic import BaseModel, ValidationError
from typing import List, Dict, Optional, Union, Literal

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
    def __init__(self, conn, redis_client):
        self.conn = conn
        self.redis = redis_client

    def create_chat_message(self, data: NewChatMessage) -> ChatMessageResponse:
        """Insert a single chat message."""
        try:
            validated = NewChatMessage(**data)
            cursor = self.conn.cursor()
            cursor.execute(
                """
                INSERT INTO thread_messages (thread_id, role, content)
                VALUES (%s, %s, %s)
                RETURNING id, thread_id, role, content, created_at
                """,
                (validated.thread_id, validated.role, validated.content),
            )
            row = cursor.fetchone()
            self.conn.commit()

            # Invalidate Redis cache
            cache_key = f"thread:{validated.thread_id}:thread_messages"
            self.redis.delete(cache_key)

            message = ChatMessage(id=str(row['id']), thread_id=str(row['thread_id']), role=str(row['role']), content=str(row['content']), created_at=str(row['created_at']))
            return ChatMessageResponse(success=True, data=message)

        except ValidationError as ve:
            return ChatMessageResponse(success=False, error=f"Validation error: {ve}")
        except Exception as e:
            return ChatMessageResponse(success=False, error=str(e))

    def get_thread_messages(self, thread_id: int, limit: int | None = None) -> ChatMessagesResponse:
        """Retrieve last N messages for a thread (with Redis cache)."""
        try:
            cache_key = f"thread:{thread_id}:thread_messages"
            cached = self.redis.get(cache_key)
            if cached:
                return ChatMessagesResponse(success=True, data=json.loads(cached)["messages"])

            cursor = self.conn.cursor()

            cursor.execute(
                """
                SELECT role, content, thread_id, id, created_at
                FROM thread_messages
                WHERE thread_id = %s
                ORDER BY created_at ASC
                """,
                (thread_id,),
            )
            rows = cursor.fetchall()
            messages = [{"id": str(r["id"]), "thread_id": str(r["thread_id"]), "role": str(r["role"]), "content": str(r["content"]), "created_at": str(r["created_at"])} for r in rows]
            # Cache in Redis for 60 minutes
            self.redis.setex(cache_key, 3600, json.dumps({"messages": messages}))

            return ChatMessagesResponse(success=True, data=messages, error=None)

        except Exception as e:
            return ChatMessagesResponse(success=False, data=None, error=str(e))

    def put_thread_messages(self, thread_id: int, new_messages: Union[Dict, List[Dict]]):
        """Insert one or many messages and invalidate cache."""
        try:
            if isinstance(new_messages, dict):
                messages_to_insert = [new_messages]
            else:
                messages_to_insert = list(new_messages)

            cursor = self.conn.cursor()
            for msg in messages_to_insert:
                cursor.execute(
                    """
                    INSERT INTO thread_messages (thread_id, role, content)
                    VALUES (%s, %s, %s)
                    """,
                    (thread_id, msg["role"], msg["content"]),
                )
            self.conn.commit()

            # Clear Redis cache
            cache_key = f"thread:{thread_id}:thread_messages"
            self.redis.delete(cache_key)

            return ChatMessagesResponse(success=True, data={"inserted": len(messages_to_insert)})

        except Exception as e:
            return ChatMessagesResponse(success=False, error=str(e))