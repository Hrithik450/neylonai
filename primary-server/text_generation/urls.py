# urls.py
from django.urls import path
from .views.view_threads import ListThreadServiceView, ThreadServiceView

urlpatterns = [
    path("threads/", ThreadServiceView.as_view(), name="thread-create"),  # POST to create
    path("threads/<uuid:thread_id>/", ThreadServiceView.as_view(), name="thread-detail"),  # GET/PUT single thread
    path("threads/user/<uuid:user_id>/", ListThreadServiceView.as_view(), name="thread-list"),  # GET threads by user
]