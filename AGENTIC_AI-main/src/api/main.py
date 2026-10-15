"""
FastAPI application entry point.

Exposes the WorkflowEngine (orchestrator/engine.py) over HTTP under
/api/* (see routes.py) and serves the static dashboard frontend
(src/api/static/) at "/", so the whole demo runs from a single command:

    uvicorn src.api.main:app --reload

then open http://127.0.0.1:8000/ in a browser.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load .env into the real process environment BEFORE anything below is
# imported. src.api.routes pulls in the tool registry (including the
# mail connector, which reads SMTP_HOST etc. at construction time), so
# this must run first or those reads see an empty environment.
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.api.routes import router, scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Background thread that fires due Automations (see
    # orchestrator/scheduler.py) - started/stopped with the server
    # process so it never outlives (or is missing during) a request.
    scheduler.start()
    yield
    scheduler.stop()


app = FastAPI(title="Agentic AI Workflow Automation", lifespan=lifespan)

# Permissive CORS so the static frontend can be opened from any origin
# (e.g. a file:// preview, or a different port) during development/demo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")

STATIC_DIR = Path(__file__).resolve().parent / "static"


@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request, exc):
    # SPA client-side routing fallback: serve index.html for non-API 404s
    if exc.status_code == 404 and not request.url.path.startswith("/api"):
        index_file = STATIC_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="dashboard")