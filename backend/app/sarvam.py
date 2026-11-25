"""Sarvam AI adapter. With no SARVAM_API_KEY it runs a fake that returns canned results, so everything works offline.

Sarvam only hears, translates, speaks and extracts. It never sees scores and never states numbers.
"""

import base64
import json
import logging

from app.config import get_settings

log = logging.getLogger(__name__)

QUESTIONS_EN = {
    "not_delivered": "The courier shows your parcel as delivered with an OTP. Who received it, or was nobody home?",
    "return": "Sorry it didn't work out. Is the tag still on the item, and has it been worn or used?",
}
# Explicit speakers per language: the SDK default speaker can be invalid. Check the speaker list on the day.
SPEAKERS = {"hi-IN": "anushka", "kn-IN": "anushka", "te-IN": "anushka", "en-IN": "anushka"}

EXTRACT_PROMPT = """You extract facts from a customer's spoken answer about a parcel. Reply with JSON only:
{"received_by": string|null, "nobody_home": true|false|null, "tag_on": true|false|null,
 "condition": "new"|"used"|"worn"|"damaged"|null, "quote": short phrase from the answer in English, max 8 words}
Do not guess: use null when the answer does not say."""

_client = None


def _sv():
    global _client
    key = get_settings().sarvam_api_key
    if not key:
        return None
    if _client is None:
        from sarvamai import SarvamAI

        _client = SarvamAI(api_subscription_key=key, timeout=35)
    return _client


def translate(text: str, target: str) -> str:
    sv = _sv()
    if sv is None or target == "en-IN":
        return text
    try:
        r = sv.text.translate(input=text, source_language_code="en-IN", target_language_code=target)
        return r.translated_text
    except Exception as e:
        log.warning("translate failed: %s", e)
        return text


def speak(text: str, lang: str) -> bytes | None:
    sv = _sv()
    if sv is None:
        return None
    try:
        r = sv.text_to_speech.convert(
            text=text, target_language_code=lang, speaker=SPEAKERS.get(lang, "anushka"), model=get_settings().sarvam_tts_model
        )
        return base64.b64decode(r.audios[0])
    except Exception as e:
        log.warning("tts failed: %s", e)
        return None


def transcribe(audio: bytes, content_type: str, filename: str = "answer.webm") -> tuple[str, str | None]:
    sv = _sv()
    if sv is None:
        return ("Nobody was home that day, I never got the parcel.", "en-IN")
    ctype = (content_type or "audio/webm").split(";", 1)[0]  # Sarvam rejects 'audio/webm;codecs=opus'
    r = sv.speech_to_text.transcribe(file=(filename, audio, ctype), model=get_settings().sarvam_stt_model)
    return (r.transcript, getattr(r, "language_code", None))


def extract(transcript: str) -> dict:
    sv = _sv()
    if sv is None:
        low = transcript.lower()
        return {
            "received_by": None,
            "nobody_home": "nobody" in low or "never" in low,
            "tag_on": False if "tag" in low and ("removed" in low or "off" in low) else None,
            "condition": "worn" if "worn" in low else None,
            "quote": "nobody was home" if "nobody" in low else None,
        }
    r = sv.chat.completions(
        model=get_settings().sarvam_llm_model,
        temperature=0,
        messages=[{"role": "system", "content": EXTRACT_PROMPT}, {"role": "user", "content": transcript}],
    )
    text = r.choices[0].message.content.strip().strip("`").removeprefix("json").strip()
    try:
        data = json.loads(text)
    except ValueError:
        log.warning("extract returned non-JSON: %s", text[:200])
        return {}
    allowed = {"received_by", "nobody_home", "tag_on", "condition", "quote"}
    return {k: v for k, v in data.items() if k in allowed}
