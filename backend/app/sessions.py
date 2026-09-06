from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.problems import get_problem
from app.prompts import INTERVIEWER_SYSTEM, DEBRIEF_SYSTEM, opening_user_message
from app.schemas import BoardState, Problem


@dataclass
class Session:
    id: str
    problem: Problem
    level: str
    duration_min: int
    created_at: str
    messages: list[dict[str, str]] = field(default_factory=list)
    transcript: list[dict[str, str]] = field(default_factory=list)


_SESSIONS: dict[str, Session] = {}


def create_session(problem_id: str, level: str, duration_min: int) -> Session:
    problem = get_problem(problem_id)
    if not problem:
        raise KeyError(f"Unknown problem: {problem_id}")
    session = Session(
        id=str(uuid.uuid4()),
        problem=problem,
        level=level,
        duration_min=duration_min,
        created_at=datetime.now(timezone.utc).isoformat(),
        messages=[
            {"role": "system", "content": INTERVIEWER_SYSTEM},
            {
                "role": "user",
                "content": opening_user_message(
                    problem.title, problem.prompt, level, duration_min
                ),
            },
        ],
    )
    _SESSIONS[session.id] = session
    return session


def get_session(session_id: str) -> Session:
    session = _SESSIONS.get(session_id)
    if not session:
        raise KeyError("Interview session not found. Start a new one.")
    return session


def append_candidate_turn(session: Session, utterance: str, board: BoardState | None) -> None:
    board_json = board.model_dump_json() if board else "{}"
    session.transcript.append({"role": "candidate", "content": utterance})
    session.messages.append(
        {
            "role": "user",
            "content": (
                f"Candidate said (voice transcript):\n{utterance}\n\n"
                f"Architecture board snapshot JSON:\n{board_json}\n\n"
                "Respond as the live interviewer JSON object."
            ),
        }
    )


def append_assistant(session: Session, raw: str) -> None:
    session.messages.append({"role": "assistant", "content": raw})
    session.transcript.append({"role": "interviewer", "content": raw})


def debrief_messages(session: Session, board: BoardState | None) -> list[dict[str, str]]:
    board_json = board.model_dump_json() if board else "{}"
    history = "\n".join(f"{t['role']}: {t['content']}" for t in session.transcript[-30:])
    return [
        {"role": "system", "content": DEBRIEF_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Problem: {session.problem.title}\nLevel: {session.level}\n"
                f"Transcript:\n{history}\n\nBoard:\n{board_json}"
            ),
        },
    ]
