import os
import traceback
from rest_framework import status
from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response

class HealthCheck(APIView):
    """
    API endpoint for Cloud Run health checks or Cloud Scheduler tasks
    """
    
    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
            return Response({"status": "ok"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"status": "error", "detail": str(e), "traceback": traceback.format_exc()}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)