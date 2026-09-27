"""LATTICE HTTP API and analyst UI."""

from __future__ import annotations

import asyncio
import contextlib
import logging
import sqlite3
from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.constants import CATEGORIES
from app.db import init_db, static_dir
from app.seed import seed_if_empty
from app import service

logger = logging.getLogger("lattice")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_if_empty()
    try:
        service.ingest_pending()
    except Exception:
        logger.exception("startup ingest failed")
    stop = asyncio.Event()

    async def loop() -> None:
        remaining = service.ingest_interval()
        while not stop.is_set():
            try:
                await asyncio.wait_for(stop.wait(), timeout=min(5, remaining))
                return
            except asyncio.TimeoutError:
                remaining -= 5
            if remaining > 0:
                continue
            if service.autonomous_enabled():
                try:
                    service.ingest_pending()
                except Exception:
                    logger.exception("ingest failed")
            remaining = service.ingest_interval()

    task = asyncio.create_task(loop())
    yield
    stop.set()
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


app = FastAPI(
    title="LATTICE",
    version="1.0.0",
    summary="Analyst workbench for actor linkage and infrastructure-indicator correlation.",
    lifespan=lifespan,
)


@app.middleware("http")
async def quiet_static_cache(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache"
    return response


class SettingsIn(BaseModel):
    autonomous_enabled: bool
    min_reliability: float = Field(ge=0, le=100)


class IndicatorIn(BaseModel):
    actor_id: int
    indicator_type: str
    observation: str = Field(min_length=8, max_length=2000)
    service_ref: str = ""
    clearnet_match: str = ""
    confidence: float = Field(ge=0, le=100)
    source: str = "analyst"


class RankIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class PersonaIn(BaseModel):
    candidate_name: str = Field(min_length=2, max_length=80)
    matched_actor_id: int
    score: float = Field(ge=0, le=100)
    evidence: str = ""
    sample: str = Field(min_length=1, max_length=20000)


def query_filters(
    q: str = "",
    category: str = "",
    source: str = "",
    min_confidence: float = 0,
    start: str = "",
    end: str = "",
) -> dict:
    category = category.strip()
    if category and category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Unknown category.")
    if not 0 <= min_confidence <= 100:
        raise HTTPException(status_code=400, detail="Confidence must be between 0 and 100.")
    return {
        "q": q.strip()[:200],
        "category": category,
        "source": source.strip(),
        "min_confidence": min_confidence,
        "start": service.start_bound(start),
        "end": service.end_bound(end),
    }


@app.get("/")
def index():
    return FileResponse(static_dir() / "index.html", headers={"Cache-Control": "no-cache"})


@app.get("/api/health")
def health():
    return {"status": "ok", "actors": len(service.list_actors({}))}


@app.get("/api/meta")
def meta():
    return service.meta()


@app.get("/api/settings")
def get_settings():
    return service.get_settings()


@app.put("/api/settings")
def put_settings(payload: SettingsIn):
    return service.update_settings(payload.autonomous_enabled, payload.min_reliability)


@app.get("/api/overview")
def overview(
    q: str = "",
    category: str = "",
    source: str = "",
    min_confidence: float = 0,
    start: str = "",
    end: str = "",
):
    return service.overview(query_filters(q, category, source, min_confidence, start, end))


@app.get("/api/actors")
def actors(
    q: str = "",
    category: str = "",
    source: str = "",
    min_confidence: float = 0,
    start: str = "",
    end: str = "",
):
    return service.list_actors(query_filters(q, category, source, min_confidence, start, end))


@app.get("/api/actors/{actor_id}")
def actor_detail(actor_id: int):
    profile = service.get_actor(actor_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Actor not found.")
    return profile


@app.get("/api/graph")
def graph(
    q: str = "",
    category: str = "",
    source: str = "",
    min_confidence: float = 0,
    start: str = "",
    end: str = "",
):
    return service.build_graph(query_filters(q, category, source, min_confidence, start, end))


@app.get("/api/indicators")
def indicators(
    q: str = "",
    category: str = "",
    source: str = "",
    min_confidence: float = 0,
    start: str = "",
    end: str = "",
):
    return service.list_indicators(query_filters(q, category, source, min_confidence, start, end))


@app.post("/api/indicators")
def create_indicator(payload: IndicatorIn):
    try:
        return service.add_indicator(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="That indicator is already stored.") from exc


@app.get("/api/inventory")
def inventory():
    return service.list_inventory()


@app.get("/api/sources")
def sources():
    return service.list_sources()


@app.get("/api/ingest/log")
def ingest_log(limit: int = Query(default=20, ge=1, le=100)):
    return service.ingest_log(limit)


@app.post("/api/ingest/run")
def ingest_run():
    return {"results": service.ingest_pending()}


@app.post("/api/ingest/retry-rejected")
def ingest_retry():
    return {"results": service.retry_rejected()}


@app.post("/api/ingest/feed")
def ingest_feed(payload: dict = Body(...)):
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Feed must be a JSON object.")
    try:
        return service.ingest_document(payload, origin="upload")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/api/stylometry/rank")
def stylometry_rank(payload: RankIn):
    return service.rank_text(payload.text)


@app.post("/api/persona-links")
def persona_links(payload: PersonaIn):
    try:
        return service.record_persona(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _filters(
    q: str,
    category: str,
    source: str,
    min_confidence: float,
    start: str,
    end: str,
) -> dict:
    return query_filters(q, category, source, min_confidence, start, end)


@app.get("/api/export/csv")
def export_csv(
    q: str = "",
    category: str = "",
    source: str = "",
    min_confidence: float = 0,
    start: str = "",
    end: str = "",
):
    content = service.export_csv(_filters(q, category, source, min_confidence, start, end))
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=lattice-actors.csv"},
    )


@app.get("/api/export/json")
def export_json(
    q: str = "",
    category: str = "",
    source: str = "",
    min_confidence: float = 0,
    start: str = "",
    end: str = "",
):
    payload = service.export_json(_filters(q, category, source, min_confidence, start, end))
    return JSONResponse(
        payload,
        headers={"Content-Disposition": "attachment; filename=lattice-actors.json"},
    )


@app.get("/api/export/report")
def export_report(
    q: str = "",
    category: str = "",
    source: str = "",
    min_confidence: float = 0,
    start: str = "",
    end: str = "",
):
    content = service.export_pdf(_filters(q, category, source, min_confidence, start, end))
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=lattice-report.pdf"},
    )


app.mount("/static", StaticFiles(directory=static_dir()), name="static")
