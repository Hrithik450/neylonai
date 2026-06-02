from rest_framework import status

from rest_framework.views import APIView
from rest_framework.response import Response
from ..serializers.user import UserResponseSerializer
from drf_spectacular.utils import extend_schema


class UserProfileView(APIView):
    @extend_schema(responses=UserResponseSerializer)
    def get(self, request):
        if not request.user.is_authenticated:
            return Response(
                {
                    "success": False,
                    "error": "Not authenticated",
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response(
            {
                "success": True,
                "user": {
                    "id": str(request.user.id),
                    "email": request.user.email,
                    "name": request.user.first_name,
                    "role": request.user.role,
                    "profile_image": request.user.profile_image,
                },
            },
            status=status.HTTP_200_OK,
        )
