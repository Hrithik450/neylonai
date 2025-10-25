# urls.py
from django.urls import path
from .views.view_text_generation import StreamChatView

urlpatterns = [
    path("text-generation/", StreamChatView.as_view(), name='text-generation')
]