# urls.py
from django.urls import path
from .views.resume_view import ResumeView

urlpatterns = [
    path("generate-resume/", ResumeView.as_view(), name='generate-resume')
]
