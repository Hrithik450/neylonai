from django.db import models

class Thread(models.Model):
    id = models.UUIDField(primary_key=True)
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField()
    user = models.ForeignKey('User', models.DO_NOTHING)

    class Meta:
        managed = False
        db_table = 'thread'


class ThreadMessages(models.Model):
    id = models.UUIDField(primary_key=True)
    thread = models.ForeignKey(Thread, models.DO_NOTHING)
    role = models.CharField(max_length=10)
    created_at = models.DateTimeField()
    content = models.TextField()

    class Meta:
        managed = False
        db_table = 'thread_messages'


class User(models.Model):
    id = models.UUIDField(primary_key=True)
    user_name = models.CharField(max_length=255)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'user'