import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Radio, Square } from "lucide-react";
import ArchitectureBoard from "./ArchitectureBoard";
import { requestDebrief, sendTurn, startInterview } from "../api";
import type { BoardState, CoachPayload, Problem, TranscriptItem } from "../types";
import { createRecognizer, speak, stopSpeaking } from "../voice";

type Props = {
  problem: Problem;
  level: string;
  durationMin: number;
  onExit: () => void;
};

const emptyBoard: BoardState = { nodes: [], edges: [], notes: "" };

export default function InterviewRoom({ problem, level, durationMin, onExit }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [board, setBoard] = useState<BoardState>(emptyBoard);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [coach, setCoach] = useState<CoachPayload | null>(null);
  const [seconds, setSeconds] = useState(durationMin * 60);
  const [typed, setTyped] = useState("");
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalBuf = useRef("");
  const silenceTimer = useRef<number | null>(null);
  const boardRef = useRef(board);
  const sessionRef = useRef(sessionId);
  const busyRef = useRef(busy);
  const listeningRef = useRef(false);
  boardRef.current = board;
  sessionRef.current = sessionId;
  busyRef.current = busy;
  listeningRef.current = listening;

  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    startInterview(problem.id, level, durationMin, (event) => {
      if (cancelled) return;
      if (event.type === "session") setSessionId(event.session.id);
      if (event.type === "error") setError(event.message);
      if (event.type === "final") applyCoach(event.payload);
    })
      .catch((e: Error) => setError(e.message))
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      stopSpeaking();
      recRef.current?.abort();
    };
  }, [problem.id, level, durationMin]);

  function applyCoach(payload: CoachPayload) {
    setCoach(payload);
    const spoken = payload.speak || "";
    if (spoken) {
      setTranscript((t) => [
        ...t,
        { role: "interviewer", text: spoken, severity: payload.severity, focus: payload.focus },
      ]);
      speak(spoken);
    }
  }

  async function submitUtterance(text: string) {
    const clean = text.trim();
    const sid = sessionRef.current;
    if (!clean || !sid || busyRef.current) return;
    setTranscript((t) => [...t, { role: "candidate", text: clean }]);
    setBusy(true);
    setError("");
    try {
      await sendTurn(sid, clean, boardRef.current, (event) => {
        if (event.type === "error") setError(event.message);
        if (event.type === "final") applyCoach(event.payload);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Turn failed");
    } finally {
      setBusy(false);
    }
  }

  function armSilenceFlush() {
    if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
    silenceTimer.current = window.setTimeout(() => {
      const text = finalBuf.current.trim();
      finalBuf.current = "";
      setInterim("");
      if (text) void submitUtterance(text);
    }, 1400);
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = createRecognizer();
    if (!rec) {
      setError("Voice needs Chrome or Edge (Web Speech API). You can still type below.");
      return;
    }
    recRef.current = rec;
    rec.onresult = (ev) => {
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalBuf.current += `${piece} `;
        else interimText += piece;
      }
      setInterim(interimText || finalBuf.current);
      armSilenceFlush();
    };
    rec.onend = () => {
      if (recRef.current === rec && listeningRef.current) {
        try {
          rec.start();
        } catch {
          setListening(false);
        }
      }
    };
    rec.start();
    setListening(true);
  }

  async function wrapUp() {
    if (!sessionId) return;
    setBusy(true);
    try {
      await requestDebrief(sessionId, board, (event) => {
        if (event.type === "error") setError(event.message);
        if (event.type === "final") applyCoach(event.payload);
      });
    } finally {
      setBusy(false);
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const severityColor =
    coach?.severity === "correct" ? "text-rose-300" : coach?.severity === "praise" ? "text-emerald-300" : "text-amber-200";

  return (
    <div className="flex h-screen flex-col p-4">
      <header className="mb-3 flex items-center gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Live interview</div>
          <h1 className="serif text-2xl">{problem.title}</h1>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="rounded-full border border-white/10 px-3 py-1 text-white/60">
            {level} · {problem.difficulty}
          </span>
          <span className="mono text-lg text-[var(--gold)]">
            {mm}:{ss}
          </span>
          <button onClick={onExit} className="rounded-full border border-white/15 px-3 py-1 text-white/70">
            Lobby
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
        <aside className="glass col-span-2 flex flex-col overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 p-4">
            <div className="text-xs uppercase tracking-wider text-white/40">Brief</div>
            <p className="mt-2 text-sm leading-relaxed text-white/75">{problem.prompt}</p>
          </div>
          <div className="space-y-4 overflow-auto p-4 text-sm">
            <section>
              <h3 className="mb-1 text-xs uppercase text-white/40">Functional</h3>
              <ul className="space-y-1 text-white/70">
                {problem.functional.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-1 text-xs uppercase text-white/40">Non-functional</h3>
              <ul className="space-y-1 text-white/70">
                {problem.non_functional.map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
            </section>
            <p className="rounded-xl bg-white/5 p-3 text-xs text-white/55">Hint: {problem.starter_hint}</p>
          </div>
        </aside>

        <section className="glass col-span-8 overflow-hidden rounded-2xl">
          <ArchitectureBoard value={board} onChange={setBoard} />
        </section>

        <aside className="glass col-span-2 flex min-h-0 flex-col overflow-hidden rounded-2xl">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/40">
              <Radio size={14} className={busy ? "text-[var(--mint)]" : "text-white/40"} />
              Interviewer · gpt-oss-120b
            </div>
            <p className={`mt-3 text-sm leading-relaxed ${severityColor}`}>
              {coach?.coach || "The interviewer will greet you by voice. Answer out loud."}
            </p>
            {coach?.board_tip ? (
              <p className="mt-2 text-xs text-[var(--mint)]">Board: {coach.board_tip}</p>
            ) : null}
            {coach?.scores ? (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {Object.entries(coach.scores).map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-white/5 px-2 py-1 capitalize">
                    {k.replace("_", " ")} · {v}/5
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
            {transcript.map((item, i) => (
              <div key={`${i}-${item.text.slice(0, 12)}`} className={item.role === "interviewer" ? "text-[var(--gold)]" : "text-white/80"}>
                <div className="text-[10px] uppercase tracking-wide text-white/35">
                  {item.role}
                  {item.focus ? ` · ${item.focus}` : ""}
                </div>
                <div className="text-sm leading-relaxed">{item.text}</div>
              </div>
            ))}
            {interim && <div className="text-sm italic text-white/45">{interim}</div>}
            {error && <div className="rounded-lg bg-rose-500/15 p-2 text-xs text-rose-200">{error}</div>}
          </div>
        </aside>
      </div>

      <footer className="glass mt-3 flex items-center gap-3 rounded-2xl px-4 py-3">
        <button
          onClick={toggleMic}
          className={`relative flex h-12 w-12 items-center justify-center rounded-full ${
            listening ? "bg-rose-500 text-white" : "bg-[var(--gold)] text-black"
          }`}
        >
          {listening ? <MicOff size={20} /> : <Mic size={20} />}
          {listening && (
            <span className="absolute inset-0 animate-[pulse-ring_1.4s_ease-out_infinite] rounded-full border border-rose-300" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-white/40">
            {listening ? "Listening — pause to send" : "Mic off — type or tap the mic"}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitUtterance(typed);
              setTyped("");
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Speak your design, or type a reply…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/30"
            />
          </form>
        </div>
        <button
          disabled={busy || !sessionId}
          onClick={() => {
            void submitUtterance(typed);
            setTyped("");
          }}
          className="rounded-full border border-white/15 px-4 py-2 text-sm disabled:opacity-40"
        >
          Send
        </button>
        <button
          onClick={() => void wrapUp()}
          className="flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-sm"
        >
          <Square size={14} /> End & debrief
        </button>
      </footer>
    </div>
  );
}
