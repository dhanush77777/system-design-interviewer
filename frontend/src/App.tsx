import { useEffect, useState } from "react";
import { fetchHealth, fetchProblems, getStoredToken, setStoredToken } from "./api";
import type { Problem } from "./types";
import InterviewRoom from "./components/InterviewRoom";
import { KeyRound, Sparkles, Volume2 } from "lucide-react";
import { getStoredVoice, getVoiceOptions, setStoredVoice, speak, subscribeToVoices, type VoiceOption } from "./voice";

const LEVEL_DETAILS = {
  junior: "Guided fundamentals",
  mid: "Independent design",
  senior: "Scale & tradeoffs",
} as const;

export default function App() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [health, setHealth] = useState<{ model: string; token_configured: boolean } | null>(null);
  const [token, setToken] = useState(getStoredToken());
  const [level, setLevel] = useState<keyof typeof LEVEL_DETAILS>("mid");
  const [bootError, setBootError] = useState("");
  const [active, setActive] = useState<Problem | null>(null);
  const [voice, setVoice] = useState(getStoredVoice());
  const [voices, setVoices] = useState<VoiceOption[]>(getVoiceOptions);

  useEffect(() => {
    Promise.all([fetchProblems(), fetchHealth()])
      .then(([p, h]) => {
        setProblems(p);
        setHealth(h);
      })
      .catch(() => setBootError("Python backend is not running on port 8000. Start it from /backend."));
  }, []);

  useEffect(() => subscribeToVoices(setVoices), []);

  if (active) {
    return (
      <InterviewRoom
        problem={active}
        level={level}
        durationMin={active.duration_min}
        onExit={() => setActive(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[var(--gold)]">
            <Sparkles size={12} /> Studio
          </div>
          <h1 className="serif text-5xl leading-tight md:text-6xl">
            Practice system design
            <br />
            <span className="italic text-white/70">with a live voice interviewer.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
            Speak your design out loud. The interviewer — OpenAI gpt-oss-120b on Hugging Face — interrupts,
            corrects, and probes in real time while you sketch the architecture.
          </p>
        </div>
        <div className="glass w-full max-w-sm rounded-2xl p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 text-white/70">
            <KeyRound size={16} /> Hugging Face token
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setStoredToken(e.target.value);
            }}
            placeholder="hf_...  (or set HF_TOKEN in .env)"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
          />
          <div className="mt-3 flex items-center justify-between text-xs text-white/45">
            <span>{health ? health.model : "checking backend…"}</span>
            <span>{health?.token_configured || token ? "token ready" : "token needed"}</span>
          </div>
          <div className="mt-4 border-t border-white/10 pt-3">
            <label className="mb-1.5 flex items-center gap-2 text-xs text-white/70">
              <Volume2 size={14} /> Interviewer voice
            </label>
            <div className="flex gap-2">
              <select
                value={voice}
                onChange={(e) => {
                  setVoice(e.target.value);
                  setStoredVoice(e.target.value);
                }}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-white outline-none"
              >
                <option value="auto">Auto-select best voice</option>
                {voices.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => speak("Hello, I’ll be your system design interviewer today. Take your time and talk me through your approach.")}
                className="rounded-xl border border-white/10 px-2.5 text-xs text-[var(--mint)] hover:bg-white/5"
              >
                Test
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-white/35">
              {voices.length ? "Your choice is saved in this browser." : "Loading your browser’s available voices…"}
            </p>
          </div>
        </div>
      </div>

      {bootError && <div className="mb-6 rounded-xl bg-rose-500/15 p-3 text-sm text-rose-100">{bootError}</div>}

      <div className="mb-6">
        <div className="mb-2 text-xs uppercase tracking-wider text-white/40">Interview level</div>
        <div className="flex gap-2" role="group" aria-label="Interview level">
        {(["junior", "mid", "senior"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            aria-pressed={level === l}
            className={`rounded-xl px-4 py-2 text-left transition ${
              level === l ? "bg-[var(--gold)] text-black shadow-lg shadow-[var(--gold)]/10" : "border border-white/10 text-white/60 hover:bg-white/5"
            }`}
          >
            <span className="block text-sm font-medium capitalize">{l}</span>
            <span className={`block text-[10px] ${level === l ? "text-black/65" : "text-white/35"}`}>{LEVEL_DETAILS[l]}</span>
          </button>
        ))}
        </div>
        <p className="mt-2 text-xs text-[var(--mint)]">Selected: {level} — {LEVEL_DETAILS[level]}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {problems.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p)}
            className="glass rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--gold)]/40"
          >
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-white/40">
              <span>{p.company_style}</span>
              <span>
                {p.difficulty} · {p.duration_min}m
              </span>
            </div>
            <h2 className="serif mt-3 text-2xl">{p.title}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-white/60">{p.prompt}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-xs text-[var(--mint)]">
              <Volume2 size={14} /> Start live interview
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
