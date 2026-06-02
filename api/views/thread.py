from ..services.thread import ThreadService

from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status

from drf_spectacular.utils import extend_schema

from api.serializers.threads import (
    ThreadRequestSerializer,
    ThreadResponseSerializer,
    ThreadsResponseSerializer,
)


class CreateThreadView(APIView):
    @extend_schema(
        operation_id="create_thread",
        request=ThreadRequestSerializer,
        responses=ThreadResponseSerializer,
    )
    def post(self, request):
        try:
            serializer = ThreadRequestSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            response = ThreadService.create_thread(data=serializer.validated_data)

            if response["success"]:
                return Response(
                    {"success": True, "data": response["data"]},
                    status=status.HTTP_201_CREATED,
                )

            return Response(
                {"success": False, "error": response["error"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ThreadDetailView(APIView):
    @extend_schema(operation_id="get_thread", responses=ThreadResponseSerializer)
    def get(self, request, thread_id: str):
        """Get a single thread details"""
        try:
            response = ThreadService.get_thread_by_id(thread_id=str(thread_id))

            if response["success"]:
                return Response(
                    {"success": True, "data": response["data"]},
                    status=status.HTTP_200_OK,
                )

            return Response(
                {"success": False, "error": response["error"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            return Response(
                {"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )


class ThreadsView(APIView):
    @extend_schema(operation_id="list_threads", responses=ThreadsResponseSerializer)
    def get(self, request, user_id: str):
        """Get all threads of a particular user"""
        try:
            response = ThreadService.list_threads(user_id=str(user_id))

            if response["success"]:
                return Response(
                    {"success": True, "data": response["data"]},
                    status=status.HTTP_200_OK,
                )

            return Response(
                {"success": False, "error": response["error"]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            return Response(
                {"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )
