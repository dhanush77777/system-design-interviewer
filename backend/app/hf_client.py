from __future__ import annotations

import json
from collections.abc import AsyncIterator

import httpx

from app.config import settings

CHAT_URL = "/chat/completions"


class HuggingFaceError(RuntimeError):
    pass


def _headers(token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


async def stream_chat(
    messages: list[dict[str, str]],
    token: str | None = None,
    max_tokens: int = 700,
    temperature: float = 0.7,
) -> AsyncIterator[str]:
    api_token = token or settings.hf_token
    if not api_token:
        raise HuggingFaceError(
            "Missing Hugging Face token. Add HF_TOKEN to .env or paste it in Settings."
        )

    payload = {
        "model": settings.hf_model,
        "messages": messages,
        "stream": True,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }

    url = settings.hf_base_url.rstrip("/") + CHAT_URL
    async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=15.0)) as client:
        async with client.stream("POST", url, headers=_headers(api_token), json=payload) as response:
            if response.status_code >= 400:
                body = (await response.aread()).decode("utf-8", errors="replace")
                raise HuggingFaceError(
                    f"Hugging Face error {response.status_code}: {body[:800]}"
                )
            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if not data or data == "[DONE]":
                    continue
                try:
                    chunk = json.loads(data)
                except json.JSONDecodeError:
                    continue
                choice = (chunk.get("choices") or [{}])[0]
                delta = choice.get("delta") or {}
                content = delta.get("content") or choice.get("text") or ""
                if isinstance(content, list):
                    content = "".join(
                        part.get("text", "") if isinstance(part, dict) else str(part)
                        for part in content
                    )
                if content:
                    yield content


def extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        return {
            "speak": text,
            "coach": "",
            "severity": "nudge",
            "focus": "hld",
            "board_tip": "",
        }
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return {
            "speak": text,
            "coach": "",
            "severity": "nudge",
            "focus": "hld",
            "board_tip": "",
        }
