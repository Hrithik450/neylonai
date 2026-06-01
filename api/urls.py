# urls.py
from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from .views.thread_messages import (
    ThreadMessageServiceView,
    ThreadMessagesServiceView,
)
from .views.threads import ListThreadServiceView, ThreadServiceView
from .views.cron_job import CronJobServiceView

from .views.user import UserServiceView
from .views.user import ProfileView

from .views.server_health import HealthCheck
from .views.google_auth import GoogleOneTapLoginView

urlpatterns = [
    path(
        "google-login/",
        csrf_exempt(GoogleOneTapLoginView.as_view()),
        name="google-login",
    ),
    path("threads/", ThreadServiceView.as_view(), name="thread-create"),
    path(
        "threads/<uuid:thread_id>/", ThreadServiceView.as_view(), name="thread-detail"
    ),
    path(
        "threads/user/<uuid:user_id>/",
        ListThreadServiceView.as_view(),
        name="thread-list",
    ),
    path("thread_messages/", ThreadMessageServiceView.as_view(), name="thread-message"),
    path(
        "thread_messages/<uuid:thread_id>/",
        ThreadMessagesServiceView.as_view(),
        name="thread-message-list",
    ),
    path("reset-tokens/", CronJobServiceView.as_view(), name="reset-tokens"),
    path(
        "user/<uuid:user_id>/", UserServiceView.as_view(), name="user-detail"
    ),  # GET/PUT
    path("me/", ProfileView.as_view(), name="profile"),
    path("health-check/", HealthCheck.as_view(), name="health-check"),
]
