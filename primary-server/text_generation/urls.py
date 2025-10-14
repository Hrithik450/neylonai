# urls.py
from django.urls import path
from .views.view_threads import ListThreadServiceView, ThreadServiceView
from .views.view_thread_messages import ThreadMessageServiceView
from .views.view_text_gen import StreamChatView
from .views.view_cron_job import CronJobServiceView

urlpatterns = [
    path("threads/", ThreadServiceView.as_view(), name="thread-create"),  # POST to create
    path("threads/<uuid:thread_id>/", ThreadServiceView.as_view(), name="thread-detail"),  # GET/PUT single thread
    path("threads/user/<uuid:user_id>/", ListThreadServiceView.as_view(), name="thread-list"),  # GET threads by user

    path("thread_messages/", ThreadMessageServiceView.as_view(), name="thread-message"),  # POST to create
    path("thread_messages/<uuid:thread_id>/", ThreadMessageServiceView.as_view(), name="thread-message-list"),  # GET threads by user

    path("text-generation/", StreamChatView.as_view(), name='text-generation'),

    path("reset-tokens/",  CronJobServiceView.as_view(), name='reset-tokens')
]