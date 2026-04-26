from django.urls import path

from .consumers import AssistantConsumer

websocket_urlpatterns = [
    path("assistant/", AssistantConsumer.as_asgi()),
]
