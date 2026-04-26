# This file defines the URL routing system of your Django project
# which maps incoming HTTP requests (URLs) to the appropriate views or handlers
# (read more about viewsets: https://www.django-rest-framework.org/api-guide/reverse/).

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include
from django.urls import path
from django.views import defaults as default_views
from django.views.generic import TemplateView
from drf_spectacular.views import SpectacularAPIView
from drf_spectacular.views import SpectacularSwaggerView
from rest_framework.authtoken.views import obtain_auth_token

from server.users.api.google.views import LogoutView
from server.users.api.google.views import google_onetap_login

from .health import health_check

# urlpatterns -> list contains all the routes of your server
# (read more about url patterns: https://docs.djangoproject.com/en/6.0/topics/http/urls/).

# path(...) -> handles the routing path (`/` -> handles home page).
# TemplateView.as_view(...) -> generic view, directly renders a template.
# template_name="..." -> specifies which template file to show.
# name="..." -> gives this route a name for later reverse lookup reference.

# handles web-pages/templates stuff...
urlpatterns = [
    path("", TemplateView.as_view(template_name="pages/home.html"), name="home"),
    path(
        "about/",
        TemplateView.as_view(template_name="pages/about.html"),
        name="about",
    ),
    # Health
    path("health/", health_check),
    # Django Admin,
    # routing path will be provided by ADMIN_URL variable in settings
    # (read more about settings: https://docs.djangoproject.com/en/6.0/ref/settings/)
    # admin.site.urls returns list of admin related url patterns.
    path(settings.ADMIN_URL, admin.site.urls),
    # User management
    # include -> includes specified application url patterns.
    # namespace provides a name for grouping for later reverse lookup reference.
    path("users/", include("server.users.urls", namespace="users")),
    path("accounts/google/login/one-tap/", google_onetap_login),
    path("accounts/google/logout/", LogoutView.as_view(), name="logout"),
    path("accounts/", include("allauth.urls")),
    # Your stuff: custom urls includes go here
    # ...
    # Media files
    # Static function creates URL patterns that map
    # media URLs to user uplaoded files in the media directory.
    # The * operator unpacks (expands) the list of generated patterns and
    # inserts them directly into urlpatterns.
    # This lets Django dev server serve uploaded files by resolving
    # URLs to filesystem paths (production uses servers like Nginx).
    *static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT),
]

if settings.DEBUG:
    # When DEBUG=True, staticfiles_urlpatterns() adds URL patterns to
    # serve static files (CSS, JS, images) via Django.
    # static files can be accessed in development This is only for development.
    # production should serve static files using a server like Nginx.
    urlpatterns += staticfiles_urlpatterns()

# API URLS (handles json data stuff...)
urlpatterns += [
    # API base url
    path("api/", include("config.api_router")),
    # DRF auth token
    # obtain_auth_token provides a viewset for authentication view.
    path("api/auth-token/", obtain_auth_token, name="obtain_auth_token"),
    # API schemas
    path("api/schema/", SpectacularAPIView.as_view(), name="api-schema"),
    # API docs
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="api-schema"),
        name="api-docs",
    ),
]

if settings.DEBUG:
    # This allows the error pages to be debugged during development, just visit
    # these url in browser to see how these error pages look like.
    urlpatterns += [
        path(
            "400/",
            default_views.bad_request,
            kwargs={"exception": Exception("Bad Request!")},
        ),
        path(
            "403/",
            default_views.permission_denied,
            kwargs={"exception": Exception("Permission Denied")},
        ),
        path(
            "404/",
            default_views.page_not_found,
            kwargs={"exception": Exception("Page not Found")},
        ),
        path("500/", default_views.server_error),
    ]

    if "debug_toolbar" in settings.INSTALLED_APPS:
        import debug_toolbar

        urlpatterns = [
            path("__debug__/", include(debug_toolbar.urls)),
            *urlpatterns,
        ]
