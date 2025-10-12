import uuid
from django.db import models

class Account(models.Model):
    userid = models.ForeignKey('User', models.DO_NOTHING, db_column='userId')  # Field name made lowercase.
    type = models.TextField()
    provider = models.TextField()
    provideraccountid = models.TextField(db_column='providerAccountId')  # Field name made lowercase.
    refresh_token = models.TextField(blank=True, null=True)
    access_token = models.TextField(blank=True, null=True)
    expires_at = models.IntegerField(blank=True, null=True)
    token_type = models.TextField(blank=True, null=True)
    scope = models.TextField(blank=True, null=True)
    id_token = models.TextField(blank=True, null=True)
    session_state = models.TextField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'account'


class Session(models.Model):
    sessiontoken = models.TextField(db_column='sessionToken', primary_key=True)  # Field name made lowercase.
    userid = models.ForeignKey('User', models.DO_NOTHING, db_column='userId')  # Field name made lowercase.
    expires = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'session'


class User(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, null=True)
    email = models.TextField(unique=True, blank=True, null=True)
    emailverified = models.DateTimeField(db_column='emailVerified', auto_now_add=True)  # Field name made lowercase.
    image = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'user'


class Thread(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey('User', models.DO_NOTHING, db_column='user_id')
    title = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'thread'


class ThreadMessages(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    thread = models.ForeignKey(Thread, models.DO_NOTHING, db_column='thread_id')
    role = models.TextField()  # This field type is a guess.
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'thread_messages'