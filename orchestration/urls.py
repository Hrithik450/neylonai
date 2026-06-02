# urls.py
from django.urls import path
from .views.agent import AgentView

urlpatterns = [path("chat/", AgentView.as_view(), name="chat")]
