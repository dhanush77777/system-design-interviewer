# System Design Studio

Live system-design practice with a **voice interviewer** powered by open-source **OpenAI gpt-oss-120b** through Hugging Face Inference Providers. The backend is Python (FastAPI). The UI is a React studio with an architecture board, live transcript, and spoken coaching.

## Stack

- **AI / backend:** Python 3.11+, FastAPI, Hugging Face router (`openai/gpt-oss-120b:fastest`)
- **Voice:** browser Web Speech API (Chrome / Edge) for mic + TTS
- **UI:** Vite + React + Tailwind

## Setup

1. Hugging Face token with Inference Providers access: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)

2. Backend:

```bash
cd system-design-interviewer
python3 -m pip install --target backend/.deps -r backend/requirements.txt
# or: python3 -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt
cp .env.example .env
# put HF_TOKEN=hf_... in .env
export PYTHONPATH="$PWD/backend/.deps:$PWD/backend"
cd backend
python3 -m uvicorn app.main:app --reload --port 8000
```

3. Frontend (another terminal):

```bash
cd system-design-interviewer/frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Paste the Hugging Face token in Settings if it is not in `.env`.

## How to practice

1. Pick a problem and level (junior / mid / senior).
2. Allow the microphone. The interviewer greets you by voice.
3. Speak your design. After a short pause, the turn is sent to gpt-oss-120b.
4. Drag building blocks onto the board; click two nodes to connect them. The board snapshot is sent with every turn so the interviewer can correct the diagram.
5. End & debrief for scores and next practice.

You can type instead of speaking if the browser has no Speech Recognition.

## Model

Default model id: `openai/gpt-oss-120b:fastest`  
Override with `HF_MODEL` (examples: `openai/gpt-oss-120b:groq`, `openai/gpt-oss-120b:cerebras`).
