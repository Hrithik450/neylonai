from ..services.model_message_service import ChatMessageService, ChatMessagesResponse, NewChatMessage
from rest_framework.response import Response
from rest_framework import status
from pydantic import ValidationError
from rest_framework.views import APIView

class ThreadMessageServiceView(APIView):

    @classmethod
    def post(cls, request):
        try:
            # Validate incoming data using Pydantic
            data = request.data
            try:
                validated_data = NewChatMessage(**data)
            except ValidationError as ve:
                return Response(
                    {"success": False, "error": f"Validation error: {ve}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Call your service to create the thread
            response = ChatMessageService.create_chat_message(data=validated_data)

            if response.success:
                return Response(
                    {"success": True, "data": response.data.model_dump()},
                    status=status.HTTP_201_CREATED
                )
            else:
                return Response(
                    {"success": False, "error": response.error},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except Exception as e:
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @classmethod
    def get(cls, request, thread_id: str):
        """Get all threads of a particular user"""
        try:
            # Get threads from service
            thread_messages_response: ChatMessagesResponse = ChatMessageService.list_recent_thread_messages(thread_id=str(thread_id))

            # Check if the service returned success (assuming thread_response has success/data/error)
            if thread_messages_response.success:
                thread_messages_data = [tm.model_dump() for tm in thread_messages_response.data]
                return Response(
                    {"success": True, "data": thread_messages_data},
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {"success": False, "error": thread_messages_response.error},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except ValidationError as ve:
            return Response(
                {"success": False, "Validation error": str(ve)}, status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )
        
class ThreadMessagesServiceView(APIView):

    @classmethod
    def get(cls, request, thread_id: str):
        """Get all threads of a particular user"""
        try:
            # Get threads from service
            thread_messages_response: ChatMessagesResponse = ChatMessageService.list_thread_messages(thread_id=str(thread_id))

            # Check if the service returned success (assuming thread_response has success/data/error)
            if thread_messages_response.success:
                thread_messages_data = [tm.model_dump() for tm in thread_messages_response.data]
                return Response(
                    {"success": True, "data": thread_messages_data},
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {"success": False, "error": thread_messages_response.error},
                    status=status.HTTP_400_BAD_REQUEST
                )

        except ValidationError as ve:
            return Response(
                {"success": False, "Validation error": str(ve)}, status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )