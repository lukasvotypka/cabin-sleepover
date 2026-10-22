# Image for the cabin planner. Build and run it with `docker compose up -d --build` (see README.md).

# --- build stage: install the locked runtime dependencies into /app/.venv with uv ---
FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /bin/uv
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never
WORKDIR /app
# Lock files first, so this layer is cached until the dependencies change.
# The app itself is not installed as a package: it runs from /app (uvicorn puts the working directory on the path).
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

# --- runtime stage: no uv, no build tools ---
FROM python:3.12-slim
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
# Non-root user. compose.yaml may run the container as another UID (CHATA_UID) so that the mounted ./data is writable.
RUN useradd --system --uid 1000 --no-create-home --shell /usr/sbin/nologin chata
WORKDIR /app
COPY --from=build /app/.venv /app/.venv
# Only what the app needs (.dockerignore keeps .env, data/, files/, tests/, tasks/ and .git out of the build).
COPY app ./app
COPY static ./static
COPY config ./config
# data/ comes from a bind mount at run time (see compose.yaml).
USER chata
EXPOSE 8010
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8010/api/health', timeout=3)"]
# --workers 1 is a correctness requirement: the write lock and the rate limits live in the memory of one process.
# --host 0.0.0.0 is needed inside a container. compose.yaml publishes the port on the host's 127.0.0.1 only.
# --proxy-headers with --forwarded-allow-ips=*: behind Docker the requests come from the bridge gateway, not from
# 127.0.0.1, so the proxy's address cannot be listed. "*" is safe only because nothing but the reverse proxy on this
# host can reach the port. Without proxy headers every client would look the same and one person's wrong codes
# would lock everybody out of joining. Do not publish the port on 0.0.0.0, anyone could then fake X-Forwarded-For.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010", "--workers", "1", "--proxy-headers", "--forwarded-allow-ips=*"]
