# urls.py
from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from .views.thread_message import (
    CreateThreadMessageView,
    RecentThreadMessagesView,
    ThreadMessagesView,
)
from .views.thread import CreateThreadView, ThreadDetailView, ThreadsView
from .views.cron_job import CronJobServiceView

from .views.user import UserProfileView

from .views.server_health import HealthCheck
from .views.google_auth import GoogleOneTapLoginView
from .views.google_auth import LogoutView

urlpatterns = [
    path(
        "google-login/",
        csrf_exempt(GoogleOneTapLoginView.as_view()),
        name="google-login",
    ),
    path("logout/", csrf_exempt(LogoutView.as_view()), name="logout"),
    path(
        "threads/",
        CreateThreadView.as_view(),
        name="thread-create",
    ),
    path(
        "threads/<uuid:thread_id>/",
        ThreadDetailView.as_view(),
        name="thread-detail",
    ),
    path(
        "threads/user/<uuid:user_id>/",
        ThreadsView.as_view(),
        name="thread-list",
    ),
    path(
        "thread_messages/",
        CreateThreadMessageView.as_view(),
        name="thread-message-create",
    ),
    path(
        "thread_messages/recent/<uuid:thread_id>/",
        RecentThreadMessagesView.as_view(),
        name="thread-message-recent",
    ),
    path(
        "thread_messages/<uuid:thread_id>/",
        ThreadMessagesView.as_view(),
        name="thread-message-list",
    ),
    path("me/", UserProfileView.as_view(), name="profile"),
    path("reset-tokens/", CronJobServiceView.as_view(), name="reset-tokens"),
    path("health-check/", HealthCheck.as_view(), name="health-check"),
]
