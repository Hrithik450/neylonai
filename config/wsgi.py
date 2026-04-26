"""
WSGI config for django-app project.

This module contains the WSGI application used by Django's development server
and any production WSGI deployments. It should expose a module-level variable
named ``application``. Django's ``runserver`` and ``runfcgi`` commands discover
this application via the ``WSGI_APPLICATION`` setting.

Usually you will have the standard Django WSGI application here, but it also
might make sense to replace the whole Django WSGI application with a custom one
that later delegates to the Django one. For example, you could introduce WSGI
middleware here, or combine a Django application with an application of another
framework.

"""

import os
import sys
from pathlib import Path

from django.core.wsgi import get_wsgi_application

# This allows easy placement of apps within the interior
# server directory.

# __file__ : special python variable which gives path of current file.
# i,e: /home/user/project/config/wsgi.py
# resolve() : converts path into absolute path. i,e: removes .. and symbiolic links
#             strict=True ensures path actually exists otherwise throws error.
# .parent : moves one folder up everytime.
BASE_DIR = Path(__file__).resolve(strict=True).parent.parent  # Path object

# sys.path : Iis used by python to find modules to import
# The / operator is overloaded to join path objects
sys.path.append(str(BASE_DIR / "server"))

# This line sets the default Django settings module (special configuration file)
# using an environment variable, ensuring
# Django knows how to configure itself when starting.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

# Main entry point for your Django project
# so web servers (like Gunicorn) can interact with it.
# It initializes Django by loading settings, registering apps,
# and setting up ORM, middleware, and URL routing.
# After setup, it returns a WSGI-compatible callable
# (WSGI = Web Server Gateway Interface).
# Web servers like Gunicorn use this application object to
# send requests to Django and receive responses.
# It bootstraps Django and exposes it for handling web requests.
application = get_wsgi_application()
