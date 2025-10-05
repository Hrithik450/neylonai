from django.contrib import admin
from .models import User, Thread, ThreadMessages

# Register your models here.
admin.site.register(User)
admin.site.register(Thread)
admin.site.register(ThreadMessages)