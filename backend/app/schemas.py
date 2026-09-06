from pydantic import BaseModel, Field


class Problem(BaseModel):
    id: str
    title: str
    company_style: str
    difficulty: str
    duration_min: int
    prompt: str
    functional: list[str]
    non_functional: list[str]
    deep_dives: list[str]
    starter_hint: str


class BoardNode(BaseModel):
    id: str
    type: str
    label: str
    x: float = 0
    y: float = 0
    description: str = ""
    technology: str = ""
    replicas: int = 1


class BoardEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str = ""
    protocol: str = ""
    async_: bool = Field(default=False, alias="async")


class BoardState(BaseModel):
    nodes: list[BoardNode] = Field(default_factory=list)
    edges: list[BoardEdge] = Field(default_factory=list)
    notes: str = ""


class StartInterviewRequest(BaseModel):
    problem_id: str
    level: str = "mid"
    duration_min: int = 45
    hf_token: str | None = None


class TurnRequest(BaseModel):
    session_id: str
    utterance: str
    board: BoardState | None = None
    hf_token: str | None = None


class DebriefRequest(BaseModel):
    session_id: str
    board: BoardState | None = None
    hf_token: str | None = None
