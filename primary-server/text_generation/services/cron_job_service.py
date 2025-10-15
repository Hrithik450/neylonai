import traceback
from typing import Optional
from pydantic import BaseModel
from ..models import User

class CronJobResponse(BaseModel):
    success: bool
    error: Optional[str] = None

class CrobJobService:

    @classmethod
    def rest_daily_limit(cls):
        try:
            updated_count = User.objects.all().update(daily_limit=200)
            print(f"Token reset successful for {updated_count} users")

            return CronJobResponse(success=True, error=None)
        except Exception as e:
            return CronJobResponse(success=False, error=f'Error occured: {str(e)}, details: {traceback.format_exc()}')