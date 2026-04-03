# Vehicle Control · 3D viewer + API

**Browser-based 3D vehicle visualization** driven by a **FastAPI** backend: speed, brake lights, and door state sync over HTTP, with **GLB** models, **semantic part mapping** (wheels, doors, lights), and **server-persisted presets** so arbitrary assets stay configurable without redeploying the client.

Built as a compact **digital-twin-style** demo: one place to preview rigged vehicles, author how the scene interprets mesh names, and treat vehicle state as the API’s job—not hard-coded in the UI.

---

## Why it’s interesting

- **Separated concerns** — The React app renders; the Python service owns authoritative state and preset storage. Swap the backend for a sim tick or fleet service without rewriting the viewer pattern.
- **Real asset pain, addressed** — Different GLBs use different hierarchies and axes. The app supports **per-model overrides**, **in-scene part picking**, **manual world-space door hinges**, and spin axis/sign tuning, then **saves** that config via the API.
- **Production-shaped UX** — Optimistic toggles with rollback, **debounced** speed writes, **polling** for multi-tab coherence, optional **hosted** flow where users paste an encoded API base URL after deploy.

---

## Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, Vite 5, Tailwind, **React Three Fiber**, Drei, postprocessing |
| Backend  | **FastAPI**, Uvicorn, **uv** (Python ≥ 3.11) |
| Assets   | glTF/GLB under `frontend/public/models/` |

---

## Quick start (local)

**1. API** — from `backend_python/`:

```bash
cd backend_python
uv sync
uv run python main.py
```

Default listen address: **`http://localhost:3001`** (override with `PORT`).

On first run, preset reads **`../backend/data/model-presets.json`** when that file exists (monorepo dev); otherwise **`backend_python/data/model-presets.json`**. Override entirely with:

```bash
export VEHICLE_PRESETS_PATH=/path/to/model-presets.json
```

**2. Frontend** — from `frontend/`:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL (e.g. `http://localhost:5173`). In dev, the app defaults to **`http://localhost:3001`** for `/health` and vehicle routes if nothing is stored yet.

---

## Connecting a deployed frontend to your API

Production builds expect a **stored API origin**. On the login screen you paste a **Base64-encoded** backend origin (the UI calls it an “API key”; it is **the URL**, not a bearer token).

- Encode your origin (no path, no trailing slash), e.g. `https://api.example.com` → Base64 in UTF-8.
- The client decodes it, normalizes to `origin`, then calls `GET {origin}/health`.

The dev default base URL constant lives in `frontend/src/api/apiConfig.js` (`DEV_DEFAULT_API_BASE`).

---

## HTTP API

Base path: `{API_ORIGIN}` (CORS allows all origins on the sample server—**tighten for real deployments**).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness (`{ "status": "ok" }`) |
| `GET` | `/vehicle/state?vehicleId=<id>` | Current state for one vehicle |
| `POST` | `/vehicle/state` | JSON body: `vehicleId` (required), optional `speed` (0–200), `brakeLights`, `doorsOpen` |
| `GET` | `/vehicle/presets` | Full preset map |
| `POST` | `/vehicle/preset` | JSON: `key` (string), `preset` (object or `null` to delete) — **persists to file** |

Vehicle state is keyed by `vehicleId` (e.g. `ferrari`, `car-concept`, `3d-truck`, or your custom upload id); missing fields default to `brakeLights: false`, `doorsOpen: false`, `speed: 0`.

---

## Docker (API only)

From `backend_python/`:

```bash
docker build -t vehicle-api .
docker run --rm -p 8000:8000 vehicle-api
```

The image sets `PORT=8000`. **Preset changes are ephemeral** unless you mount a volume, for example:

```bash
docker run --rm -p 8000:8000 -v vehicle-presets:/app/data vehicle-api
```

---

## Repository layout

```
├── frontend/                 # Vite + React + R3F app
│   └── public/models/        # Built-in GLBs
├── backend/
│   └── data/
│       └── model-presets.json   # Shared preset file (dev default for API)
└── backend_python/           # FastAPI service + Dockerfile
```

---

## License / usage

Use and modify for portfolios, interviews, and experiments. For any public or production deployment, **replace open CORS**, **authenticate** your API if it is internet-facing, and **review** what you expose in preset JSON.
