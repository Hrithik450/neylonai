import requests
import logging

from typing import TYPE_CHECKING
from django.contrib.auth import login, logout
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View
from django.http import JsonResponse

from rest_framework import status

from allauth.account.internal.decorators import login_not_required
from allauth.socialaccount.adapter import get_adapter
from allauth.socialaccount.helpers import (
    render_authentication_error,
)
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.providers.oauth2.client import OAuth2Error
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from django.http import HttpRequest
    from server.users.models import User
    from allauth.socialaccount.models import SocialLogin
    from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
    from allauth.socialaccount.providers.google.provider import GoogleProvider


@method_decorator(login_not_required, name="dispatch")
class GoogleOneTapLoginView(View):

    def dispatch(self, request):
        self.adapter: "DefaultSocialAccountAdapter" = get_adapter()
        self.provider: "GoogleProvider" = self.adapter.get_provider(
            request, GoogleOAuth2Adapter.provider_id
        )
        try:
            return super().dispatch(request)
        except (
            OAuth2Error,
            requests.RequestException,
            PermissionDenied,
            ValidationError,
        ) as exc:
            return render_authentication_error(request, self.provider, exception=exc)

    def get(self, request):
        # If we leave out get() it will return a response with a 405, but
        # we really want to show an authentication error.
        raise PermissionDenied("405")

    def post(self, request: "HttpRequest", *args, **kwargs):
        try:
            credential = request.POST.get("credential")
            if not credential:
                return JsonResponse(
                    {"success": False, "data": None, "error": "Missing credential"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            sociallogin: "SocialLogin" = self.provider.verify_token(
                request, {"id_token": credential}
            )

            sociallogin.lookup()
            user: "User" = sociallogin.user

            if sociallogin.account.pk:
                logger.info(f"Existing social login for user: {user.email}")
            elif user and user.pk:
                logger.info(f"Connecting social account to existing user: {user.email}")
                sociallogin.connect(request, user)
            else:
                logger.info("Creating new user via google login")
                sociallogin.save(request)
                user = sociallogin.user

            picture = sociallogin.account.extra_data.get("picture")

            login(
                request,
                user,
                backend="allauth.account.auth_backends.AuthenticationBackend",
            )

            return JsonResponse(
                {
                    "success": True,
                    "data": {
                        "user": {
                            "id": user.id,
                            "email": user.email,
                            "name": user.get_full_name(),
                            "profile_image": picture,
                            "role": user.is_staff,
                        },
                    },
                    "error": None,
                },
                status=status.HTTP_200_OK,
            )

        except ImmediateHttpResponse as e:
            logger.warning("Allauth interruption during login")
            return e.response

        except ValueError as e:
            logger.warning(f"Validation error: {str(e)}")
            return self._error(
                "Invalid request data", status=status.HTTP_400_BAD_REQUEST
            )

        except Exception as e:
            logger.exception("Unexpected error during Google login")
            return self._error(
                "Something went wrong", status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _error(self, message, status=status.HTTP_400_BAD_REQUEST):
        return JsonResponse(
            {"success": False, "data": None, "error": message}, status=status
        )


google_onetap_login = csrf_exempt(GoogleOneTapLoginView.as_view())


class LogoutView(View):
    def post(self, request):

        logout(request)

        return JsonResponse(
            {
                "success": True,
                "data": None,
                "error": None,
            },
            status=status.HTTP_200_OK,
        )
