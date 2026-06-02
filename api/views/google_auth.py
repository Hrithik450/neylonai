from google.oauth2 import id_token
from google.auth.transport import requests

from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth import logout

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from api.models import User
from api.serializers.user import UserResponseSerializer

from drf_spectacular.utils import extend_schema


class GoogleOneTapLoginView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(responses=UserResponseSerializer)
    def post(self, request):
        credential = request.data.get("credential")
        if not credential:
            return Response(
                {"success": False, "data": None, "error": "Missing credential"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token_info = id_token.verify_oauth2_token(
                credential, requests.Request(), settings.GOOGLE_CLIENT_ID
            )

            if not token_info.get("email_verified"):
                return Response(
                    {
                        "success": False,
                        "data": None,
                        "error": "Email not verified",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            google_id = token_info["sub"]
            email = token_info["email"]
            name = token_info.get("name", "")
            picture = token_info.get("picture", "")

            user, created = User.objects.get_or_create(
                google_id=google_id,
                defaults={
                    "username": email,
                    "email": email,
                    "first_name": name,
                    "profile_image": picture,
                },
            )

            if not created:
                user.first_name = name
                user.profile_image = picture
                user.save()

            login(request, user)

            return Response(
                {
                    "success": True,
                    "user": {
                        "id": user.id,
                        "email": user.email,
                        "name": user.first_name,
                        "role": user.role,
                        "profile_image": user.profile_image,
                    },
                    "error": None,
                }
            )
        except Exception as e:
            return Response(
                {"success": False, "error": str(e)}, status=status.HTTP_400_BAD_REQUEST
            )


class LogoutView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        logout(request)

        return Response(
            {"success": True, "data": None, "error": None}, status=status.HTTP_200_OK
        )
