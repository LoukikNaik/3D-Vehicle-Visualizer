# Vehicle API — production image (FastAPI + uv)
# Build:  docker build -t vehicle-api .
# Run:    docker run --rm -p 8000:8000 vehicle-api
# Presets persist only if you mount a volume, e.g.:
#   docker run --rm -p 8000:8000 -v vehicle-presets:/app/data vehicle-api

FROM python:3.12-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-cache --no-install-project

COPY main.py ./

ENV PATH="/app/.venv/bin:$PATH" \
    PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import os,urllib.request as u;p=os.environ.get('PORT','8000');u.urlopen('http://127.0.0.1:%s/health'%p)"

CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port \"${PORT}\""]
