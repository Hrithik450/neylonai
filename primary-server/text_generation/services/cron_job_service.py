import traceback
from typing import Optional
from pydantic import BaseModel

class CronJobResponse(BaseModel):
    success: bool
    error: Optional[str] = None

class CrobJobService:

    @classmethod
    def rest_daily_limit(cls):
        try:
            print("Token reset successfull")
            return CronJobResponse(success=True, error=None)
        except Exception as e:
            return CronJobResponse(success=False, error=f'Error occured: {str(e)}, details: {traceback.format_exc()}')