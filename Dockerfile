FROM python:3.12-slim AS app-build

LABEL org.opencontainers.image.authors="Hrithik M <mhrithik450@gmail.com>"
LABEL org.opencontainers.image.source="github.com/Hrithik450"
LABEL org.opencontainers.image.version="1.0"

WORKDIR /app

ARG APP_UID=1000
ARG APP_GID=1000

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential curl libpq-dev \
  && rm -rf /var/lib/apt/lists/* /usr/share/doc /usr/share/man \
  && apt-get clean \
  && groupadd -g "${APP_GID}" appgroup \
  && useradd --create-home --no-log-init -u "${APP_UID}" -g "${APP_GID}" appuser \
  && chown appuser:appgroup -R /app

COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /uvx /usr/local/bin/

USER appuser

COPY --chown=appuser:appgroup pyproject.toml uv.lock* ./
COPY --chown=appuser:appgroup bin/ ./bin

ENV PYTHONUNBUFFERED="true" \
  PYTHONPATH="." \
  UV_COMPILE_BYTECODE=1 \
  UV_PROJECT_ENVIRONMENT="/home/appuser/.local" \
  PATH="${PATH}:/home/appuser/.local/bin" \
  USER="appuser"

RUN chmod 0755 bin/* && bin/uv-install

CMD ["bash"]

###############################################################################

FROM python:3.12-slim AS app

LABEL org.opencontainers.image.authors="Hrithik M <mhrithik450@gmail.com>"
LABEL org.opencontainers.image.source="github.com/Hrithik450"
LABEL org.opencontainers.image.version="1.0"

WORKDIR /app

ARG APP_UID=1000
ARG APP_GID=1000

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential curl libpq-dev \
  && rm -rf /var/lib/apt/lists/* /usr/share/doc /usr/share/man \
  && apt-get clean \
  && groupadd -g "${APP_GID}" appgroup \
  && useradd --create-home --no-log-init -u "${APP_UID}" -g "${APP_GID}" appuser \
  && mkdir -p /public_collected \
  && chown appuser:appgroup -R /public_collected /app

COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /uvx /usr/local/bin/

USER appuser

ARG DEBUG="false"
ENV DEBUG="${DEBUG}" \
  PYTHONUNBUFFERED="true" \
  PYTHONPATH="." \
  UV_PROJECT_ENVIRONMENT="/home/appuser/.local" \
  PATH="${PATH}:/home/appuser/.local/bin" \
  USER="appuser"

COPY --chown=appuser:appgroup --from=app-build /home/appuser/.local /home/appuser/.local
COPY --from=app-build /usr/local/bin/uv /usr/local/bin/uvx /usr/local/bin/
COPY --chown=appuser:appgroup . .
COPY --chown=appuser:appgroup --from=app-build /app/bin /app/bin

RUN if [ "${DEBUG}" = "false" ]; then \
  SECRET_KEY=dummyvalue python3 manage.py collectstatic --no-input; \
  else mkdir -p /app/public_collected; fi

RUN chmod 0755 bin/*

ENTRYPOINT [ "/app/bin/entrypoint.sh" ]

EXPOSE ${PORT:-8000}

CMD ["gunicorn"]