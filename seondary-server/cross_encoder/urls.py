# urls.py
from django.urls import path
from .views import EncoderAPIView  # Import your API view

urlpatterns = [
    path("encode/", EncoderAPIView.as_view(), name="encode"),  # POST requests go here
]