# TruthLens X Frontend (Phase 2)

This directory is reserved for the Phase 2 React/Vite/Tailwind forensic analysis dashboard.

## Key Design Principles
- Single-page application consuming FastAPI backend endpoints (`/api/v1/cases`, `/api/v1/evidence`, `/api/v1/graph`, `/api/v1/timeline`).
- Prominent and persistent **MOCK DATA** ribbon whenever `VITE_USE_MOCKS=true` or mock cases are loaded (Rule 4).
- Honest forensic metric display: strict prohibition of global fake percentages or fabricated accuracy scores (Rule 2).
- Plain-language alternative explanations rendered for every weak/moderate indicator and contradiction edge (Rule 2).
