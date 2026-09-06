import type { BoardState, ChatEvent } from "./types";

const TOKEN_KEY = "sdi_hf_token";

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

async function readSse(
  response: Response,
  onEvent: (event: ChatEvent) => void
) {
  if (!response.body) throw new Error("No response body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      onEvent(JSON.parse(data) as ChatEvent);
    }
  }
}

export async function fetchProblems() {
  const res = await fetch("/api/problems");
  if (!res.ok) throw new Error("Failed to load problems");
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("Backend is not running");
  return res.json() as Promise<{ ok: boolean; model: string; token_configured: boolean }>;
}

export async function startInterview(
  problemId: string,
  level: string,
  durationMin: number,
  onEvent: (event: ChatEvent) => void
) {
  const res = await fetch("/api/interview/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      problem_id: problemId,
      level,
      duration_min: durationMin,
      hf_token: getStoredToken() || null,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  await readSse(res, onEvent);
}

export async function sendTurn(
  sessionId: string,
  utterance: string,
  board: BoardState,
  onEvent: (event: ChatEvent) => void
) {
  const res = await fetch("/api/interview/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      utterance,
      board,
      hf_token: getStoredToken() || null,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  await readSse(res, onEvent);
}

export async function requestDebrief(
  sessionId: string,
  board: BoardState,
  onEvent: (event: ChatEvent) => void
) {
  const res = await fetch("/api/interview/debrief", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      board,
      hf_token: getStoredToken() || null,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  await readSse(res, onEvent);
}
