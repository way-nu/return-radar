import uuid
from contextlib import asynccontextmanager
from typing import Literal

from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import flags, sarvam
from app.config import get_settings
from app.db import Claim, Customer, Order, get_session, init_db, now
from app.scoring import build_input, score_claim

MAX_AUDIO_BYTES = 2_000_000
_audio_cache: dict[tuple[str, str], bytes] = {}
_question_cache: dict[tuple[str, str], str] = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(title="ReturnRadar API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().allowed_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


class AppError(Exception):
    def __init__(self, code: str, status: int, detail: str):
        self.code, self.status, self.detail = code, status, detail


@app.exception_handler(AppError)
async def app_error(_: Request, e: AppError):
    return JSONResponse({"error": e.code, "detail": e.detail}, status_code=e.status)


# ---------- schemas ----------
class ClaimIn(BaseModel):
    order_id: str
    type: Literal["return", "not_delivered"]
    reason_text: str = ""


class DecisionIn(BaseModel):
    action: Literal["approve", "reject"]
    reason: str = Field(min_length=5)


class FormIn(BaseModel):
    received_by: str | None = None
    nobody_home: bool | None = None
    tag_on: bool | None = None
    condition: Literal["new", "used", "worn", "damaged"] | None = None


def claim_out(c: Claim) -> dict:
    return {
        "id": c.id, "order_id": c.order_id, "customer_id": c.customer_id, "type": c.type,
        "reason_text": c.reason_text, "status": c.status, "score": c.score, "level": c.level, "fired": c.fired,
        "answers": c.answers, "transcript": c.transcript, "language": c.language,
        "question_style": c.question_style, "decision": c.decision, "decision_reason": c.decision_reason,
        "decided_at": c.decided_at, "created_at": c.created_at,
    }


async def _claim(s: AsyncSession, claim_id: str) -> Claim:
    c = await s.get(Claim, claim_id)
    if c is None:
        raise AppError("not_found", 404, "No such claim")
    return c


# ---------- health and config ----------
@app.get("/api/healthz")
async def healthz():
    return {"ok": True}


@app.get("/api/readyz")
async def readyz(s: AsyncSession = Depends(get_session)):
    await s.execute(select(1))
    return {"ok": True}


@app.get("/api/config")
async def config(identifier: str | None = None):
    return flags.get_config(identifier)


# ---------- demo store ----------
@app.get("/api/demo/orders")
async def demo_orders(customer_id: str = "C-1042", s: AsyncSession = Depends(get_session)):
    cust = await s.get(Customer, customer_id)
    if cust is None:
        raise AppError("not_found", 404, "No such customer")
    orders = (await s.scalars(select(Order).where(Order.customer_id == customer_id).order_by(Order.ordered_at.desc()))).all()
    return {
        "customer": {"id": cust.id, "name": cust.name, "city": cust.city, "language": cust.language},
        "orders": [
            {"id": o.id, "item_name": o.item_name, "value_paise": o.value_paise, "ordered_at": o.ordered_at,
             "delivered_at": o.delivered_at, "returned": o.returned}
            for o in orders[:5]
        ],
    }


# ---------- claims (brand side) ----------
@app.post("/api/claims", status_code=201)
async def create_claim(body: ClaimIn, s: AsyncSession = Depends(get_session)):
    order = await s.get(Order, body.order_id)
    if order is None or order.tenant_id != get_settings().tenant_id:
        raise AppError("invalid_claim", 422, f"Order {body.order_id} not found for this brand")
    c = Claim(id=uuid.uuid4().hex[:10], tenant_id=order.tenant_id, order_id=order.id, customer_id=order.customer_id,
              type=body.type, reason_text=body.reason_text, created_at=now())
    s.add(c)
    await s.flush()
    await score_claim(s, c, flags.get_config(c.customer_id))
    await s.commit()
    return {"claim": claim_out(c), "customer_link": f"/c/{c.id}"}


@app.get("/api/claims")
async def list_claims(level: str | None = None, status: str | None = None, s: AsyncSession = Depends(get_session)):
    q = select(Claim).where(Claim.tenant_id == get_settings().tenant_id)
    if level:
        q = q.where(Claim.level == level)
    if status:
        q = q.where(Claim.status == status)
    rows = (await s.scalars(q.order_by(Claim.score.desc(), Claim.created_at.desc()).limit(100))).all()
    orders = {o.id: o for o in (await s.scalars(select(Order).where(Order.id.in_([r.order_id for r in rows])))).all()}
    return {"items": [claim_out(c) | {"item_name": orders[c.order_id].item_name,
                                      "value_paise": orders[c.order_id].value_paise} for c in rows]}


@app.get("/api/claims/{claim_id}")
async def get_claim(claim_id: str, s: AsyncSession = Depends(get_session)):
    c = await _claim(s, claim_id)
    o = await s.get(Order, c.order_id)
    cust = await s.get(Customer, c.customer_id)
    inp = await build_input(s, c)
    return {
        "claim": claim_out(c),
        "order": {"id": o.id, "item_name": o.item_name, "category": o.category, "value_paise": o.value_paise,
                  "payment": o.payment, "ordered_at": o.ordered_at, "delivered_at": o.delivered_at,
                  "otp_verified": o.otp_verified, "gps_distance_m": o.gps_distance_m},
        "customer": {"id": cust.id, "name": cust.name, "city": cust.city, "language": cust.language,
                     "phone_masked": cust.phone[:3] + "*****" + cust.phone[-3:], "orders": inp.customer_orders,
                     "returns": inp.customer_returns, "previous_claims": inp.customer_prev_claims,
                     "linked_ids": inp.linked_ids},
        "brand_return_rate": round(inp.brand_return_rate, 3),
    }


@app.post("/api/claims/{claim_id}/decision")
async def decide(claim_id: str, body: DecisionIn, s: AsyncSession = Depends(get_session)):
    c = await _claim(s, claim_id)
    if c.status == "decided":
        raise AppError("already_decided", 409, "This claim is already decided")
    c.decision, c.decision_reason, c.decided_at, c.status = body.action, body.reason, now(), "decided"
    await s.commit()
    return claim_out(c)


# ---------- customer side ----------
@app.get("/api/c/{claim_id}")
async def customer_view(claim_id: str, s: AsyncSession = Depends(get_session)):
    c = await _claim(s, claim_id)
    o = await s.get(Order, c.order_id)
    cust = await s.get(Customer, c.customer_id)
    cfg = flags.get_config(c.customer_id)
    if c.question_style is None:  # exposure recorded once, on first open
        c.question_style = cfg["question_style"]
        await s.commit()
    key = (c.type, cust.language)
    if key not in _question_cache:
        _question_cache[key] = sarvam.translate(sarvam.QUESTIONS_EN[c.type], cust.language)
    return {
        "brand": "Utsav Ethnic", "item_name": o.item_name, "value_paise": o.value_paise, "type": c.type,
        "language": cust.language, "question": _question_cache[key], "question_en": sarvam.QUESTIONS_EN[c.type],
        "audio_url": f"/api/c/{c.id}/audio", "mode": cfg["fact_finding_mode"], "question_style": c.question_style,
        "answered": c.answers is not None,
    }


@app.get("/api/c/{claim_id}/audio")
async def question_audio(claim_id: str, s: AsyncSession = Depends(get_session)):
    c = await _claim(s, claim_id)
    cust = await s.get(Customer, c.customer_id)
    key = (c.type, cust.language)
    if key not in _audio_cache:
        text = _question_cache.get(key) or sarvam.translate(sarvam.QUESTIONS_EN[c.type], cust.language)
        audio = sarvam.speak(text, cust.language)
        if audio is None:
            raise HTTPException(503, "Audio unavailable")
        _audio_cache[key] = audio
    return Response(_audio_cache[key], media_type="audio/wav")


async def _apply_answers(s: AsyncSession, c: Claim, answers: dict) -> None:
    c.answers = answers
    c.status = "scored"
    await score_claim(s, c, flags.get_config(c.customer_id))
    await s.commit()
    flags.track("fact_finding_completed", c.customer_id)


@app.post("/api/c/{claim_id}/answer")
async def answer(claim_id: str, audio: UploadFile = File(...), s: AsyncSession = Depends(get_session)):
    c = await _claim(s, claim_id)
    data = await audio.read()
    if len(data) > MAX_AUDIO_BYTES:
        raise AppError("audio_too_long", 413, "Please keep the answer under 30 seconds")
    try:
        transcript, lang = sarvam.transcribe(data, audio.content_type or "audio/webm", audio.filename or "answer.webm")
        extracted = sarvam.extract(transcript)
    except Exception as e:
        raise AppError("stt_failed", 502, f"Could not understand the recording: {e}") from e
    c.transcript, c.language = transcript, lang
    await _apply_answers(s, c, extracted)
    return {"ok": True}


@app.post("/api/c/{claim_id}/form")
async def answer_form(claim_id: str, body: FormIn, s: AsyncSession = Depends(get_session)):
    c = await _claim(s, claim_id)
    await _apply_answers(s, c, body.model_dump())
    return {"ok": True}


# ---------- the incident ----------
class ImportIn(BaseModel):
    order_ids: list[str]


@app.post("/api/admin/import")
async def bulk_import(body: ImportIn, s: AsyncSession = Depends(get_session)):
    """Bulk claim import after Diwali. PLANTED BUG for the NudgeBee demo: it builds an 'evidence bundle' for every
    claim in memory before writing anything (no streaming, no batching). With a 128Mi limit a big import OOMKills
    the pod. Disclosed in the README. Fix after recording: score and write in batches of 50."""
    bundles = []
    for oid in body.order_ids:
        bundles.append(bytearray(1_000_000))  # simulated courier photos + scan history per claim
    created = 0
    for oid in body.order_ids:
        order = await s.get(Order, oid)
        if order is None:
            continue
        c = Claim(id=uuid.uuid4().hex[:10], tenant_id=order.tenant_id, order_id=oid, customer_id=order.customer_id,
                  type="return", reason_text="bulk import", created_at=now())
        s.add(c)
        await s.flush()
        await score_claim(s, c, flags.get_config(c.customer_id))
        created += 1
    await s.commit()
    return {"created": created, "bundles": len(bundles)}
