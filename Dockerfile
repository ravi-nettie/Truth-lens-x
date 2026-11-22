# TruthLens X — Offline Multimodal Media Forensics
# Single-port production Docker container (FastAPI + React SPA + FFmpeg)

# Stage 1: Build Frontend React SPA
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python & FFmpeg Container
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies: FFmpeg, ffprobe, libgl for OpenCV, curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first for optimal Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source trees
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY samples/ ./samples/
COPY Makefile ./Makefile

# Copy built frontend production bundle from frontend-builder
COPY --from=frontend-builder /app/frontend/dist/ ./frontend/dist/

# Provision local-first persistence directories
RUN mkdir -p /app/data /app/models /app/data/evidence /app/data/artifacts /app/data/tmp

# Default configuration: 100% offline, local-first on CPU
ENV DATA_DIR=/app/data
ENV MODELS_DIR=/app/models
ENV ENABLE_OPTIONAL_MODELS=false
ENV VITE_USE_MOCKS=false

EXPOSE 8000

# Native healthcheck verifying offline API status
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Launch single-port production server (supports cloud $PORT or default 8000)
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
