import json
import traceback
from typing import Optional, Literal, Dict, Any
from pydantic import BaseModel, ValidationError
from django.db import connection, transaction
from django.core.cache import cache

class UserFormat(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    emailverified: Optional[str] = None
    image: Optional[str] = None
    daily_limit: int
    created_at: str
    assistant: Literal["internal_assistant", "customer_service_assistant", "resume_assistant"] = "internal_assistant"
    role: Literal["business_owner", "student", "explorer", "admin"] = "explorer"

class UserResponse(BaseModel):
    success: bool
    data: Optional[UserFormat] = None
    error: Optional[str] = None

class UserService:
    """
    Service for user operations including tokens deduction with Redis caching
    """

    @staticmethod
    def deduct_tokens(deduction_tokens: int, user_id: str) -> UserResponse:
        try:
           with transaction.atomic():
                with connection.cursor() as cursor:
                    # Fetch the user
                    cursor.execute("""
                        SELECT id, name, email, "emailVerified", image, daily_limit, created_at, assistant, role
                        FROM "user"
                        WHERE id = %s
                        LIMIT 1;
                    """, [str(user_id)])
                    row = cursor.fetchone()

                    if not row:
                        return UserResponse(success=False, data=None, error=f"User {user_id} not found")
                    
                    id_db, name, email, emailVerified, image, daily_limit, created_at, assistant, role = row
                    new_daily_limit = max(0, daily_limit - deduction_tokens)

                    cursor.execute("""
                        UPDATE "user"
                        SET daily_limit = %s
                        WHERE id = %s
                    """, [new_daily_limit, id_db])

           cache_key = f"user:{user_id}"
           cache.delete(cache_key)

           user_response = UserFormat(id=str(id_db), name=str(name), email=str(email), emailverified=str(emailVerified), image=str(image), daily_limit=int(new_daily_limit), created_at=str(created_at.isoformat()), assistant=str(assistant), role=str(role))
           return UserResponse(success=True, data=user_response, error=None)
        
        except Exception as e:
            return UserResponse(success=False, error=f"Error: {str(e)}, details: {traceback.format_exc()}")

    @staticmethod
    def update_user(user_id: str, data: Dict[str, Any]) -> UserResponse:
        try:
            if not data:
                return UserResponse(success=False, error="No fields to update")

            set_clauses = []
            params = []
            for field, value in data.items():
                if field in ["assistant", "role"]:
                    set_clauses.append(f'"{field}" = %s')
                    params.append(value)
            params.append(user_id)

            if not set_clauses:
                return UserResponse(success=False, error="No updatable fields provided")

            sql = f"""
                UPDATE "user"
                SET {', '.join(set_clauses)}
                WHERE id = %s
                RETURNING id, name, email, "emailVerified", image, daily_limit, created_at, assistant, role;
            """

            # Get the thread instance
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute(sql, params)
                    row = cursor.fetchone()

            if not row:
                return UserResponse(success=False, error=f"User {user_id} not found")

            # Clear cache if needed
            cache_key = f"user:{user_id}"
            cache.delete(cache_key)

            # Return updated thread as Pydantic model
            updated_user = UserFormat(id=str(row[0]), name=str(row[1]), email=str(row[2]), emailverified=row[3], image=str(row[4]), daily_limit=int(row[5]), created_at=str(row[6].isoformat()), assistant=str(row[7]), role=str(row[8]))
            return UserResponse(success=True, data=updated_user, error=None)

        except ValidationError as ve:
            return UserResponse(success=False, error=f"Validation error: {ve.errors()}")
        except Exception as e:
            return UserResponse(success=False, error=str(e))

    @staticmethod
    def get_user_by_id(user_id: str) -> UserResponse:
        try:
            cache_key = f"user:{user_id}"
            cache.delete(cache_key)
            cached_value = cache.get(cache_key)
            if cached_value:
                 # Deserialize cached data
                cached_data = json.loads(cached_value)
                # Convert each dict to ChatThread
                cached_user = UserFormat(**cached_data)
                return UserResponse(success=True, data=cached_user, error=None)
            
            with transaction.atomic():
                with connection.cursor() as cursor:
                    # Fetch the user
                    cursor.execute("""
                        SELECT id, name, email, "emailVerified", image, daily_limit, created_at, assistant, role
                        FROM "user"
                        WHERE id = %s
                        LIMIT 1;
                    """, [str(user_id)])
                    row = cursor.fetchone()

            if not row:
                return UserResponse(success=False, data=None, error=f"User {user_id} not found")

            user_response = UserFormat(id=str(row[0]), name=str(row[1]), email=str(row[2]), emailverified=str(row[3]), image=str(row[4]), daily_limit=int(row[5]), created_at=str(row[6].isoformat()), assistant=str(row[7]), role=str(row[8]))

            cache.set(cache_key, json.dumps(user_response.model_dump()), timeout=3600)
            return UserResponse(success=True, data=user_response, error=None)

        except Exception as e:
            return UserResponse(success=False, error=f"Error: {str(e)}, details: {traceback.format_exc()}")