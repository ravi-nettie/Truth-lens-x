.PHONY: doctor setup dev test test-smoke demo docker-build docker-up docker-down help

PYTHON ?= python3

help:
	@echo "TruthLens X Build & Development Commands"
	@echo "  make doctor       - Verify Python 3.11+, Node 20+, FFmpeg 6+ & local models"
	@echo "  make setup        - Install dependencies, download models, build frontend"
	@echo "  make dev          - Launch local development server (Uvicorn on port 8000)"
	@echo "  make test-smoke   - Run fast unit tests (< 2 min)"
	@echo "  make test         - Run full test suite (unit + 17-case matrix)"
	@echo "  make demo         - Seed demo case and start single-port offline server on 8000"
	@echo "  make docker-build - Build production Docker container image"
	@echo "  make docker-up    - Run containerized TruthLens X via docker compose"
	@echo "  make docker-down  - Stop running Docker containers"

doctor:
	$(PYTHON) scripts/doctor.py

setup:
	$(PYTHON) -m pip install -r requirements.txt
	$(PYTHON) scripts/download_models.py
	cd frontend && npm ci && npm run build

dev:
	$(PYTHON) -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

test-smoke:
	$(PYTHON) -m pytest backend/tests/unit/

test:
	$(PYTHON) -m pytest backend/tests/unit/
	$(PYTHON) scripts/run_17_tests.py

demo:
	$(PYTHON) scripts/seed_demo.py
	$(PYTHON) -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down
