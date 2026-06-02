from api.services.thread_message import ThreadMessageService

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from drf_spectacular.utils import extend_schema
from api.serializers.thread_message import (
    ThreadMessageRequestSerializer,
    ThreadMessageResponseSerializer,
    ThreadMessagesResponseSerializer,
)


class CreateThreadMessageView(APIView):

    @extend_schema(
        operation_id="create_thread_message",
        request=ThreadMessageRequestSerializer,
        responses=ThreadMessageResponseSerializer,
    )
    def post(self, request):
        try:
            serializer = ThreadMessageRequestSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            response = ThreadMessageService.create_thead_message(
                data=serializer.validated_data
            )

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


class RecentThreadMessagesView(APIView):
    @extend_schema(
        operation_id="list_recent_thread_messages",
        responses=ThreadMessageResponseSerializer,
    )
    def get(cls, request, thread_id: str):
        """Get all threads of a particular user"""
        try:
            response = ThreadMessageService.list_recent_thread_messages(
                thread_id=str(thread_id)
            )

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


class ThreadMessagesView(APIView):

    @extend_schema(
        operation_id="list_thread_messages", responses=ThreadMessagesResponseSerializer
    )
    def get(cls, request, thread_id: str):
        """Get all threads of a particular user"""
        try:

            response = ThreadMessageService.list_thread_messages(
                thread_id=str(thread_id)
            )

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
