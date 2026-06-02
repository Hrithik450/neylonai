from rest_framework import serializers
from api.models import User


class UserSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name")

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "name",
            "role",
            "profile_image",
        )


class UserResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    user = UserSerializer(required=False, allow_null=True)
    error = serializers.CharField(required=False, allow_null=True)
