"""API tests on a throwaway SQLite file, with fake Sarvam and default flags (env overrides backend/.env)."""

import os
import tempfile
from datetime import datetime

_db = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ.update(DATABASE_URL=f"sqlite+aiosqlite:///{_db}", SARVAM_API_KEY="", FLAGSMITH_SERVER_KEY="")

import httpx
import pytest

from app import flags
from app.db import Customer, Order, Session, init_db
from app.main import app


@pytest.fixture(scope="module")
async def client():
    await init_db()
    async with Session() as s:
        s.add(Customer(id="C-1", tenant_id="utsav", name="Ravi", phone="9800000001", address="1 MG Road",
                       city="Pune", language="en-IN"))
        for i in range(3):
            s.add(Order(id=f"O-{i}", tenant_id="utsav", customer_id="C-1", item_name="Silk Lehenga",
                        category="occasion", value_paise=1_250_000, payment="prepaid",
                        ordered_at=datetime(2026, 11, 1), delivered_at=datetime(2026, 11, 12, 14, 2),
                        otp_verified=True, gps_distance_m=40))
        await s.commit()
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://t") as c:
        yield c


async def test_rescore_uses_current_thresholds(client, monkeypatch):
    r = await client.post("/api/claims", json={"order_id": "O-0", "type": "not_delivered"})
    claim = r.json()["claim"]
    assert claim["score"] == 40 and claim["level"] == "medium"  # R1 only, default medium >= 30, high >= 60

    cfg = flags.get_config() | {"risk_thresholds": {"medium": 10, "high": 40}}
    monkeypatch.setattr(flags, "get_config", lambda identifier=None: cfg)
    r = await client.post(f"/api/claims/{claim['id']}/rescore")
    assert r.status_code == 200
    out = r.json()
    assert out["score"] == 40 and out["level"] == "high"
    assert out["fired"][0]["rule_id"] == "R1" and out["status"] == "awaiting_customer"


async def test_rescore_unknown_claim_404(client):
    r = await client.post("/api/claims/nope/rescore")
    assert r.status_code == 404 and r.json()["error"] == "not_found"


async def test_stats_counts_completion_by_question_style(client, monkeypatch):
    ids = []
    for oid in ("O-1", "O-2"):
        ids.append((await client.post("/api/claims", json={"order_id": oid, "type": "return"})).json()["claim"]["id"])
    styles = iter(["voice_note", "text_form"])
    real = flags.get_config
    for cid in ids:  # first open records the exposure
        style = next(styles)
        monkeypatch.setattr(flags, "get_config", lambda identifier=None, st=style: real(identifier) | {"question_style": st})
        assert (await client.get(f"/api/c/{cid}")).json()["question_style"] == style
    await client.post(f"/api/c/{ids[1]}/form", json={"tag_on": True, "condition": "new"})

    by_style = (await client.get("/api/stats")).json()["fact_finding"]["by_question_style"]
    assert by_style == {"voice_note": {"exposed": 1, "completed": 0}, "text_form": {"exposed": 1, "completed": 1}}


def test_config_parses_flagsmith_values(monkeypatch):
    """Flagsmith returns JSON flag values as strings; /api/config must hand back real objects."""
    values = {"risk_thresholds": '{"medium": 25, "high": 55}', "rules_enabled": '["R1","R2"]',
              "fact_finding_mode": "form", "question_style": "text_form"}

    class FakeFlags:
        def get_feature_value(self, name):
            return values[name]

    class FakeFS:
        def get_environment_flags(self):
            return FakeFlags()

        def get_identity_flags(self, identifier):
            return FakeFlags()

    monkeypatch.setattr(flags, "_fs", lambda: FakeFS())
    assert flags.get_config("C-1") == {"risk_thresholds": {"medium": 25, "high": 55}, "rules_enabled": ["R1", "R2"],
                                       "fact_finding_mode": "form", "question_style": "text_form"}


def test_config_falls_back_on_flagsmith_error(monkeypatch):
    class Down:
        def get_environment_flags(self):
            raise ConnectionError("down")

    monkeypatch.setattr(flags, "_fs", lambda: Down())
    assert flags.get_config() == flags.DEFAULTS
