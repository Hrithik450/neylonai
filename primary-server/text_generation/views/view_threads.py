from ..services.model_thread_service import ChatThreadService, ChatThreadsResponse, NewChatThread, ChatThreadResponse
from rest_framework.response import Response
from rest_framework import status
from pydantic import ValidationError
from rest_framework.views import APIView

class ThreadServiceView(APIView):
    def post(self, request):
        try:
            # Validate incoming data using Pydantic
            data = request.data
            try:
                validated_data = NewChatThread(**data)
            except ValidationError as ve:
                return Response(
                    {"success": False, "error": f"Validation error: {ve}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Call your service to create the thread
            response = ChatThreadService.create_chat_thread(data=validated_data)

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
    
    def put(self, request, thread_id: str):
        try:
            # Validate incoming data using Pydantic
            data = request.data
            try:
                validated_data = NewChatThread(**data)
            except ValidationError as ve:
                return Response(
                    {"success": False, "error": f"Validation error: {ve}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Call your service to update the thread
            response = ChatThreadService.update_chat_thread(thread_id=str(thread_id), data=validated_data)

            if response.success:
                return Response(
                    {"success": True, "data": response.data.model_dump()},
                    status=status.HTTP_205_RESET_CONTENT
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
    
    def get(self, request, thread_id: str):
        """Get a single thread details"""
        try:
            response: ChatThreadResponse = ChatThreadService.get_chat_thread_by_id(thread_id=str(thread_id))
            if response.success:
                return Response(
                    {"success": True, "data": response.data.model_dump()},
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {"success": False, "error": response.error},
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

class ListThreadServiceView(APIView):
    def get(self, request, user_id: str):
        """Get all threads of a particular user"""
        try:
            # Get threads from service
            thread_response: ChatThreadsResponse = ChatThreadService.list_chat_threads(user_id=str(user_id))

            # Check if the service returned success (assuming thread_response has success/data/error)
            if thread_response.success:
                threads_data = [t.model_dump() for t in thread_response.data]
                return Response(
                    {"success": True, "data": threads_data},
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {"success": False, "error": thread_response.error},
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