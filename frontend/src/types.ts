export type Problem = {
  id: string;
  title: string;
  company_style: string;
  difficulty: string;
  duration_min: number;
  prompt: string;
  functional: string[];
  non_functional: string[];
  deep_dives: string[];
  starter_hint: string;
};

export type BoardNode = {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  description?: string;
  technology?: string;
  replicas?: number;
};

export type BoardEdge = {
  id: string;
  source: string;
  target: string;
  label: string;
  protocol?: string;
  async?: boolean;
};

export type BoardState = {
  nodes: BoardNode[];
  edges: BoardEdge[];
  notes: string;
};

export type CoachPayload = {
  speak?: string;
  coach?: string;
  severity?: "praise" | "nudge" | "correct";
  focus?: string;
  board_tip?: string;
  scores?: Record<string, number>;
  strengths?: string[];
  improvements?: string[];
  next_practice?: string;
};

export type ChatEvent =
  | { type: "session"; session: { id: string; problem: Problem; level: string; duration_min: number } }
  | { type: "delta"; text: string }
  | { type: "final"; payload: CoachPayload; raw: string }
  | { type: "error"; message: string };

export type TranscriptItem = {
  role: "candidate" | "interviewer" | "system";
  text: string;
  severity?: string;
  focus?: string;
};
