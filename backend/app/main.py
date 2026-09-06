from __future__ import annotations

import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.config import ROOT, settings
from app.hf_client import HuggingFaceError, extract_json, stream_chat
from app.problems import PROBLEMS
from app.schemas import DebriefRequest, StartInterviewRequest, TurnRequest
from app import sessions as session_store

app = FastAPI(title="System Design Interviewer", version="1.0.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "model": settings.hf_model,
        "token_configured": bool(settings.hf_token),
    }


@app.get("/api/problems")
async def list_problems():
    return [p.model_dump() for p in PROBLEMS]


@app.post("/api/interview/start")
async def start_interview(body: StartInterviewRequest):
    try:
        session = session_store.create_session(body.problem_id, body.level, body.duration_min)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    async def events():
        yield f"data: {json.dumps({'type': 'session', 'session': {
            'id': session.id,
            'problem': session.problem.model_dump(),
            'level': session.level,
            'duration_min': session.duration_min,
        }})}\n\n"
        raw_parts: list[str] = []
        try:
            async for token in stream_chat(session.messages, token=body.hf_token):
                raw_parts.append(token)
                yield f"data: {json.dumps({'type': 'delta', 'text': token})}\n\n"
        except HuggingFaceError as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            return
        raw = "".join(raw_parts)
        session_store.append_assistant(session, raw)
        parsed = extract_json(raw)
        yield f"data: {json.dumps({'type': 'final', 'payload': parsed, 'raw': raw})}\n\n"

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/interview/turn")
async def interview_turn(body: TurnRequest):
    try:
        session = session_store.get_session(body.session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    session_store.append_candidate_turn(session, body.utterance, body.board)

    async def events():
        raw_parts: list[str] = []
        try:
            async for token in stream_chat(session.messages, token=body.hf_token):
                raw_parts.append(token)
                yield f"data: {json.dumps({'type': 'delta', 'text': token})}\n\n"
        except HuggingFaceError as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            return
        raw = "".join(raw_parts)
        session_store.append_assistant(session, raw)
        parsed = extract_json(raw)
        yield f"data: {json.dumps({'type': 'final', 'payload': parsed, 'raw': raw})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


@app.post("/api/interview/debrief")
async def debrief(body: DebriefRequest):
    try:
        session = session_store.get_session(body.session_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    messages = session_store.debrief_messages(session, body.board)

    async def events():
        raw_parts: list[str] = []
        try:
            async for token in stream_chat(messages, token=body.hf_token, max_tokens=900):
                raw_parts.append(token)
                yield f"data: {json.dumps({'type': 'delta', 'text': token})}\n\n"
        except HuggingFaceError as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"
            return
        raw = "".join(raw_parts)
        yield f"data: {json.dumps({'type': 'final', 'payload': extract_json(raw), 'raw': raw})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")


# In development Vite serves the UI. In Render, the build creates this directory
# and FastAPI serves the same-origin single-page application and API together.
frontend_dist = ROOT / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
