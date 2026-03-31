"""
Vehicle API — Python equivalent of backend/server.js.

Local:
  uv sync && uv run uvicorn main:app --host 0.0.0.0 --port 3001

Docker:
  docker build -t vehicle-api . && docker run --rm -p 8000:8000 vehicle-api

Env:
  PORT                         — listen port (default 3001 locally; Dockerfile sets 8000 unless overridden)
  VEHICLE_PRESETS_PATH         — override path to model-presets.json
  If unset: uses ../backend/data/model-presets.json when present (monorepo dev),
  else ./data/model-presets.json (Docker and standalone).
"""

from __future__ import annotations

import copy
import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict

_ROOT = Path(__file__).resolve().parent


def resolve_presets_path() -> Path:
    env = os.environ.get("VEHICLE_PRESETS_PATH")
    if env:
        return Path(env).expanduser()
    shared = _ROOT.parent / "backend" / "data" / "model-presets.json"
    if shared.is_file():
        return shared
    return _ROOT / "data" / "model-presets.json"


PRESETS_FILE = resolve_presets_path()

DEFAULT_VEHICLE_STATE: dict[str, Any] = {
    "brakeLights": False,
    "doorsOpen": False,
    "speed": 0,
}

vehicle_states: dict[str, dict[str, Any]] = {}


def read_presets_from_disk() -> dict[str, Any]:
    try:
        raw = PRESETS_FILE.read_text(encoding="utf-8")
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            return parsed
    except (OSError, json.JSONDecodeError):
        pass
    return {}


def write_presets_to_disk(obj: dict[str, Any]) -> None:
    PRESETS_FILE.parent.mkdir(parents=True, exist_ok=True)
    PRESETS_FILE.write_text(json.dumps(obj, indent=2), encoding="utf-8")


model_presets: dict[str, Any] = read_presets_from_disk()


def state_for(vehicle_id: str) -> dict[str, Any]:
    cur = vehicle_states.get(vehicle_id)
    if cur:
        return {**DEFAULT_VEHICLE_STATE, **cur}
    return {**DEFAULT_VEHICLE_STATE}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    port = os.environ.get("PORT", "3001")
    print("Vehicle API (Python) — preset file:", PRESETS_FILE)
    print(f"Try: curl 'http://localhost:{port}/vehicle/state?vehicleId=ferrari'")
    yield


app = FastAPI(title="Vehicle API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/vehicle/state")
def get_vehicle_state(
    vehicleId: str | None = Query(default=None, alias="vehicleId"),
) -> dict[str, Any]:
    if vehicleId is None or not str(vehicleId).strip():
        raise HTTPException(
            status_code=400,
            detail={"error": "vehicleId query parameter required"},
        )
    return state_for(str(vehicleId).strip())


class VehicleStateUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    vehicleId: str
    brakeLights: bool | None = None
    doorsOpen: bool | None = None
    speed: float | int | None = None


@app.post("/vehicle/state")
def post_vehicle_state(body: VehicleStateUpdate) -> dict[str, Any]:
    if not body.vehicleId or not str(body.vehicleId).strip():
        raise HTTPException(
            status_code=400,
            detail={"error": "vehicleId required in body"},
        )
    vid = str(body.vehicleId).strip()
    nxt = copy.deepcopy(state_for(vid))
    if body.brakeLights is not None:
        nxt["brakeLights"] = body.brakeLights
    if body.doorsOpen is not None:
        nxt["doorsOpen"] = body.doorsOpen
    if body.speed is not None and not isinstance(body.speed, bool):
        if isinstance(body.speed, (int, float)):
            nxt["speed"] = max(0, min(200, float(body.speed)))
    vehicle_states[vid] = nxt
    print("[State updated]", vid, nxt)
    return nxt


@app.get("/vehicle/presets")
def get_presets() -> dict[str, Any]:
    return model_presets


class PresetUpdate(BaseModel):
    key: str
    preset: Any | None = None


@app.post("/vehicle/preset")
def post_preset(body: PresetUpdate) -> dict[str, Any]:
    if not body.key or not str(body.key).strip():
        raise HTTPException(
            status_code=400,
            detail={"error": "key required (string)"},
        )
    global model_presets
    key = str(body.key).strip()
    model_presets = {**model_presets}
    if body.preset is None:
        model_presets.pop(key, None)
    else:
        model_presets[key] = body.preset
    write_presets_to_disk(model_presets)
    label = f"cleared {key}" if body.preset is None else f"saved {key}"
    print("[Preset]", label)
    return {"ok": True, "key": key}


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "3001"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
