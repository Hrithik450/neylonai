from rest_framework import serializers
from api.models import ThreadMessage


class ThreadMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ThreadMessage
        fields = "__all__"


class ThreadMessageRequestSerializer(serializers.Serializer):
    thread_id = serializers.UUIDField()
    role = serializers.CharField(max_length=50)
    content = serializers.CharField()


class ThreadMessageResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    data = ThreadMessageSerializer(required=False, allow_null=True)
    error = serializers.CharField(required=False, allow_null=True)


class ThreadMessagesResponseSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    data = ThreadMessageSerializer(many=True, required=False, allow_null=True)
    error = serializers.CharField(required=False, allow_null=True)
