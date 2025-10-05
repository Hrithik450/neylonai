import uuid
from django.db import models

class Thread(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey('User', models.DO_NOTHING, db_column='user_id')

    class Meta:
        managed = False
        db_table = 'thread'


class ThreadMessages(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(Thread, models.DO_NOTHING, db_column='thread_id')
    role = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    content = models.TextField()

    class Meta:
        managed = False
        db_table = 'thread_messages'


class User(models.Model):
    id = models.UUIDField(primary_key=True)
    user_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'user'