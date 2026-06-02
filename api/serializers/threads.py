from rest_framework import serializers
from api.models import Thread


class ThreadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Thread
        fields = "__all__"


class ThreadRequestSerializer(serializers.Serializer):
    title = serializers.CharField()
    user_id = serializers.UUIDField()


class ThreadResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    data = ThreadSerializer(required=False, allow_null=True)
    error = serializers.CharField(required=False, allow_null=True)


class ThreadsResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    data = ThreadSerializer(many=True, required=False, allow_null=True)
    error = serializers.CharField(required=False, allow_null=True)
