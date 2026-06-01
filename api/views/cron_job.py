import os
import traceback
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from ..services.cron_job_service import CrobJobService, CronJobResponse


class CronJobServiceView(APIView):
    """
    API endpoint for Cloud Scheduler to trigger daily tasks
    """

    CRON_SECRET = os.getenv("CRON_SECRET")
    cron_job_service = CrobJobService()

    def post(self, request, *args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if auth_header != f"Bearer {CronJobServiceView.CRON_SECRET}":
            return Response(
                {"success": False, "error": "Unauthorized"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            cron_job_response: CronJobResponse = (
                CronJobServiceView.cron_job_service.reset_daily_limit()
            )
            if not cron_job_response.success:
                return Response(
                    {
                        "success": False,
                        "error": f"Error occurred while executing cron job: {cron_job_response.error}",
                        "traceback": traceback.format_exc(),
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            return Response(
                {"success": True, "message": "Cron job executed successfully"},
                status=status.HTTP_200_OK,
            )

        except Exception as e:
            print(f"Error executing task: {e}")
            return Response(
                {
                    "success": False,
                    "error": f"Internal server error {str(e)}",
                    "traceback": traceback.format_exc(),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
