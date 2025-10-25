from rest_framework import status
from pydantic import ValidationError
from rest_framework.views import APIView
from rest_framework.request import Request
from rest_framework.response import Response
from ..services.model_user_service import UserResponse, UserService

class UserServiceView(APIView):
    user_service = UserService()

    @classmethod
    def put(cls, request: Request, user_id: str):
        """Update a single user details"""
        data = request.data
        try:
            response: UserResponse = UserService.update_user(user_id=str(user_id), data=data)
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

    @classmethod
    def get(cls, request: Request, user_id: str):
        """Get a single user details"""
        try:
            response: UserResponse = UserService.get_user_by_id(user_id=str(user_id))
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