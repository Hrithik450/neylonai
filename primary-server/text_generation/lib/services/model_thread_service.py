import json
import redis
from typing import List,Optional
from psycopg2.pool import SimpleConnectionPool
from pydantic import BaseModel, ValidationError
from .model_message_service import ChatMessage
from text_generation.models import Thread

# --- Schema (like zod schema) ---
class ChatThread(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: str
    messages: Optional[List[ChatMessage]] = None

class NewChatThread(BaseModel):
    user_id: str
    title: str

class ChatThreadUpdateSchema(BaseModel):
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
    def __init__(self, conn: SimpleConnectionPool, redis_client: redis.Redis):
        self.conn = conn
        self.redis = redis_client

    def create_chat_thread(self, data: NewChatThread) -> ChatThreadResponse:
        try:
            # Validate input (equivalent to zod.parse)
            validated = NewChatThread(**data)

            cursor = self.conn.cursor()
            cursor.execute(
                """
                INSERT INTO thread (user_id, title)
                VALUES (%s, %s)
                RETURNING id, title, created_at, user_id
                """,
                (validated.user_id, validated.title),
            )
            row = cursor.fetchone()
            self.conn.commit()

            if not row:
                return ChatThreadResponse(success=False, error="Could not able to create chat_thread")

            # Clear Redis cache for user’s last thread
            cache_key = f"user:{validated.user_id}:user_threads"
            self.redis.delete(cache_key)

            new_thread = ChatThread(id=str(row['id']), user_id=str(row['user_id']), title=str(row['title']), created_at=str(row['created_at']))
            return ChatThreadResponse(success=True, data=new_thread)
        
        except ValidationError as ve:
            return ChatThreadResponse(success=False, error=f"Validation error: {ve}")
        except Exception as e:
            return ChatThreadResponse(success=False, error=str(e))
        
    def update_chat_thread(self, thread_id: int, data: ChatThreadUpdateSchema) -> ChatThreadResponse:
        try:
            # Validate partial data (like zod.partial())
            validated_data = ChatThreadUpdateSchema(**data)

            # Build dynamic SET clause for SQL
            set_clauses = []
            values = []
            for field, value in validated_data.model_dump(exclude_unset=True).items():
                set_clauses.append(f"{field} = %s")
                values.append(value)

            if not set_clauses:
                return ChatThreadResponse(success=False, error="No fields to update")
            
            values.append(thread_id)  # for WHERE id = %s
            sql = f"UPDATE thread SET {', '.join(set_clauses)} WHERE id = %s RETURNING id, title, created_at, user_id"

            cursor = self.conn.cursor()
            cursor.execute(sql, values)
            row = cursor.fetchone()
            self.conn.commit()

            if not row:
                return ChatThreadResponse(success=False, error="ChatThread not found")
            
            if self.redis and validated_data.user_id:
                cache_key = f"thread:{thread_id}:user_thread"
                self.redis.delete(cache_key)

            thread = ChatThread(id=str(row['id']), user_id=str(row['user_id']), title=str(row['title']), created_at=str(row['created_at']))
            return ChatThreadResponse(success=True, data=thread)
            
        except ValidationError as ve:
            return ChatThreadResponse(success=False, error=f"Validation error: {ve}")
        except Exception as e:
            return ChatThreadResponse(success=False, error=str(e))
        
    def get_chat_thread_by_id(self, thread_id: int) -> ChatThreadResponse:
        try:
            # Check Redis cache first
            cache_key = f"thread:{thread_id}:user_thread"
            cached_value = self.redis.get(cache_key)
            if cached_value:
                return json.loads(cached_value)

            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT id, title, created_at, user_id
                FROM thread 
                WHERE id = %s
            """, (thread_id,))
            row = cursor.fetchone()
            if not row:
                return ChatThreadResponse(success=False, error="ChatThread not found")
            
            thread = {"id": str(row['id']), "user_id": str(row['user_id']), "title": str(row['title']), "created_at": str(row['created_at'])}
            return ChatThreadResponse(success=True, data=thread)
        
        except Exception as e:
            return ChatThreadResponse(success=False, error=str(e))
        
    def list_chat_threads(self, user_id: str) -> ChatThreadsResponse:
        try:
            # Check Redis cache first
            cache_key = f"user:{user_id}:user_threads"
            cached_value = self.redis.get(cache_key)
            if cached_value:
                return json.loads(cached_value)
        
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT id, title, created_at, user_id
                FROM thread
                WHERE user_id = %s 
                ORDER BY created_at DESC
            """, (user_id,))
            rows = cursor.fetchall()

            if not rows:
                return ChatThreadsResponse(success=False, error="No ChatThreads are there, please create one")
            
            threads = [{"id": str(r['id']), "user_id": str(r['user_id']), "title": str(r['title']), "created_at": str(r['created_at'])} for r in rows]
            return ChatThreadsResponse(success=True, data=threads)
        
        except Exception as e:
            return ChatThreadsResponse(success=False, error=str(e))