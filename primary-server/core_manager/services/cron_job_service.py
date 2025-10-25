import traceback
from typing import Optional
from pydantic import BaseModel
from django.db import transaction, connection

class CronJobResponse(BaseModel):
    success: bool
    error: Optional[str] = None

class CrobJobService:

    @classmethod
    def rest_daily_limit(cls):
        try:
            with transaction.atomic():
                with connection.cursor() as cursor:
                    cursor.execute("""
                        UPDATE "user"
                        SET daily_limit = 200
                    """)
                    updated_count = cursor.rowcount

            print(f"Token reset successful for {updated_count} users")
            return CronJobResponse(success=True, error=None)
        
        except Exception as e:
            return CronJobResponse(success=False, error=f'Error occured: {str(e)}, details: {traceback.format_exc()}')