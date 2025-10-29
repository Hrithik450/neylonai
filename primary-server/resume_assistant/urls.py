# urls.py
from django.urls import path
from .views.view_generate_resume import GenerateResumeView

urlpatterns = [
    path("generate-resume/", GenerateResumeView.as_view(), name='generate-resume')
]
