# urls.py
from django.urls import path
from .views.view_text_generation import InternalAssistantView

urlpatterns = [
    path("text-generation/", InternalAssistantView.as_view(), name='text-generation')
]