# This file defines how your api endpoints are generated automatically.
# Instead of manually writing URLs,
# Django REST framework creates them using a router (read more about routers: https://www.django-rest-framework.org/api-guide/routers/).

from django.conf import settings
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from server.users.api.views import UserViewSet

# Default router: generates api routes and
# provides a special page /api/ that lists all your endpoints (clickable) like a menu.
# useful for debugging purpose.
# Simple router: no special page, only generates api routes.
router = DefaultRouter() if settings.DEBUG else SimpleRouter()

# router.register(...) automatically generates all CRUD api endpoints for each viewset
# (read more about viewset at: https://www.django-rest-framework.org/api-guide/viewsets/).
# example:-
# /api/users/          → GET (name=user-list)
# /api/users/1/        → GET (name=user-list)
# /api/users/          → POST (name=user-detail)
# /api/users/1/        → PUT/PATCH (name=user-detail)
# /api/users/1/        → DELETE (name=user-detail)

# names are used for reverse-lookups (
# read more about reverse lookups at: https://www.django-rest-framework.org/api-guide/reverse/)
router.register("users", UserViewSet)

# provides a namespace ("api") for all URLs in this file, used for reverse lookups.
app_name = "api"

# Converts router urls into actual django url patterns
# (read more about url patterns: https://docs.djangoproject.com/en/6.0/topics/http/urls/).
urlpatterns = router.urls
