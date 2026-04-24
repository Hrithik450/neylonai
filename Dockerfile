FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"
ENV DJANGO_SETTINGS_MODULE=config.settings.production
ENV PORT=8080

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE ${PORT}

CMD ["sh", "-c", "uvicorn config.asgi:application \
    --host 0.0.0.0 \
    --port ${PORT} \
    --log-level info"]