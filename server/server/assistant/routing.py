from django.urls import re_path
from .consumers import AssistantConsumer

websocket_urlpatterns = [
    re_path(r"assistant/$", AssistantConsumer.as_asgi())
]