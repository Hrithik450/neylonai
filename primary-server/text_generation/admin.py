from django.contrib import admin
from .models import User, Thread, ThreadMessages, Account, Session

# Register your models here.
admin.site.register(User)
admin.site.register(Thread)
admin.site.register(ThreadMessages)
admin.site.register(Account)
admin.site.register(Session)