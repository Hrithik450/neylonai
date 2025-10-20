import json
import traceback
from typing import Optional
from pydantic import BaseModel
from ..models import User
from django.core.cache import cache

class UserFormat(BaseModel):
    id: str
    name: Optional[str] = None
    email: Optional[str] = None
    emailverified: Optional[str] = None
    image: Optional[str] = None
    daily_limit: int
    created_at: str

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
           user = User.objects.get(id=user_id)
           user.daily_limit = max(0, user.daily_limit-deduction_tokens)
           user.save()

           cache_key = f"user:{user_id}"
           cache.delete(cache_key)

           user_response = UserFormat(
                id=str(user.id),
                name=str(user.name),
                email=str(user.email),
                emailVerified=str(user.emailverified),
                image=str(user.image),
                daily_limit=int(user.daily_limit),
                created_at=str(user.created_at)
            )
           
           return UserResponse(success=True, data=user_response, error=None)

        except User.DoesNotExist:
            return UserResponse(success=False, data=None ,error=f"User with id:{user_id} does not exist")
        except Exception as e:
            return UserResponse(success=False, error=f"Error: {str(e)}, details: {traceback.format_exc()}")

    @staticmethod
    def get_user_by_id(user_id: str) -> UserResponse:
        try:
            cache_key = f"user:{user_id}"
            cached_value = cache.get(cache_key)
            if cached_value:
                 # Deserialize cached data
                cached_data = json.loads(cached_value)
                # Convert each dict to ChatThread
                cached_user = UserFormat(**cached_data)
                return UserResponse(success=True, data=cached_user, error=None)
            
            user_obj = User.objects.get(id=user_id)

            user_response = UserFormat(
                id=str(user_obj.id),
                name=str(user_obj.name),
                email=str(user_obj.email),
                emailVerified=str(user_obj.emailverified),
                image=str(user_obj.image),
                daily_limit=int(user_obj.daily_limit),
                created_at=str(user_obj.created_at)
            )

            cache.set(cache_key, json.dumps(user_response.model_dump()), timeout=3600)
            return UserResponse(success=True, data=user_response, error=None)

        except User.DoesNotExist:
            return UserResponse(success=False, data=None, error=f"User with id:{user_id} does not exist")
        except Exception as e:
            return UserResponse(success=False, error=f"Error: {str(e)}, details: {traceback.format_exc()}")