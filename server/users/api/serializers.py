from rest_framework import serializers

from server.users.models import User
from allauth.socialaccount.models import SocialAccount


class UserSerializer(serializers.ModelSerializer[User]):
    name = serializers.SerializerMethodField()
    profile_image = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "name", "profile_image", "role"]

        extra_kwargs = {
            "url": {"view_name": "api:user-detail", "lookup_field": "pk"},
        }

    def get_name(self, obj):
        return obj.get_full_name()

    def get_profile_image(self, obj):
        social = SocialAccount.objects.filter(user=obj, provider="google").first()
        if social:
            return social.extra_data.get("picture")
        return None

    def get_role(self, obj):
        return obj.is_staff
