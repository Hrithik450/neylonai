from django.core.cache import cache
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.mixins import ListModelMixin
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.mixins import UpdateModelMixin
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from server.users.models import User

from .serializers import UserSerializer


class UserViewSet(RetrieveModelMixin, ListModelMixin, UpdateModelMixin, GenericViewSet):
    serializer_class = UserSerializer
    queryset = User.objects.all()
    lookup_field = "pk"

    def get_queryset(self, *args, **kwargs):
        assert isinstance(self.request.user.id, int)
        return self.queryset.filter(id=self.request.user.id)

    @action(detail=False, methods=["get"])
    @method_decorator(ensure_csrf_cookie)
    def me(self, request):
        if not request.user.is_authenticated:
            return Response(
                {"success": False, "data": None, "error": "User not authenticated"},
                status=status.HTTP_200_OK,
            )
        cache_key = f"user_me_{request.user.id}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(
                {"success": True, "data": {"user": cached_data}, "error": None}
            )

        serializer = UserSerializer(request.user, context={"request": request})
        data = serializer.data

        cache.set(cache_key, data, timeout=3600)

        return Response(
            {"success": True, "data": {"user": data}, "error": None},
            status=status.HTTP_200_OK,
        )
