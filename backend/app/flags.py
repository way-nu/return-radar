"""Flagsmith wrapper. Never raises: every value has a default so the app works with no key or no network."""

import json
import logging

from app.config import get_settings

log = logging.getLogger(__name__)

DEFAULTS = {
    "risk_thresholds": {"medium": 30, "high": 60},
    "rules_enabled": ["R1", "R2", "R3", "R4", "R5"],
    "fact_finding_mode": "voice",  # voice | form  (kill switch)
    "question_style": "voice_note",  # experiment: voice_note | text_form
}

_client = None


def _fs():
    global _client
    key = get_settings().flagsmith_server_key
    if not key:
        return None
    if _client is None:
        from flagsmith import Flagsmith
        from flagsmith.analytics import EventProcessorConfig

        st = get_settings()
        kwargs = {"api_url": st.flagsmith_api_url} if st.flagsmith_api_url else {}
        if st.flagsmith_events_url:
            kwargs["event_processor_config"] = EventProcessorConfig(events_api_url=st.flagsmith_events_url)
        # enable_events is required for track_event (the experiment metric); without it the SDK raises ValueError
        _client = Flagsmith(environment_key=key, enable_analytics=True, enable_events=True, **kwargs)
    return _client


def _parse(v, default):
    if v is None:
        return default
    if isinstance(default, (dict, list)) and isinstance(v, str):
        try:
            return json.loads(v)
        except ValueError:
            return default
    return v


def get_config(identifier: str | None = None) -> dict:
    cfg = dict(DEFAULTS)
    fs = _fs()
    if fs is None:
        return cfg
    try:
        flags = fs.get_identity_flags(identifier) if identifier else fs.get_environment_flags()
        for name, default in DEFAULTS.items():
            try:
                cfg[name] = _parse(flags.get_feature_value(name), default)
            except Exception:  # flag missing in Flagsmith -> keep default
                pass
    except Exception as e:  # network or SDK error -> defaults
        log.warning("flagsmith unavailable: %s", e)
    return cfg


def track(event: str, identifier: str) -> None:
    """Experiment metric. Wire to Flagsmith Experimentation's event call (see docs/sponsors/flagsmith.md)."""
    fs = _fs()
    if fs is None:
        return
    try:
        fs.track_event(event, identifier=identifier)
    except Exception as e:
        log.warning("flagsmith track failed: %s", e)
