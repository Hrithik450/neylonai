#!/bin/bash

if [ "$1" = "gunicorn" ]; then
  exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:${PORT:-8000} \
    --workers 1 \
    --access-logfile -
fi

exec "$@"
