"""Risk rules: pure functions, no I/O, no AI. Each rule returns a Fired or None.

Every reason is a sentence with the exact numbers that made the rule fire.
"""

from dataclasses import dataclass, field
from datetime import date, datetime

FESTIVALS = {"Diwali": date(2026, 11, 8)}
WARDROBING_WINDOW_DAYS = 4


@dataclass(frozen=True)
class Fired:
    rule_id: str
    points: int
    reason: str


@dataclass
class Answers:
    received_by: str | None = None  # who received the parcel, in the customer's words
    nobody_home: bool | None = None  # customer says nobody was home / parcel never came
    tag_on: bool | None = None
    condition: str | None = None  # new | used | worn | damaged
    quote: str | None = None  # short quote from the transcript, used in R5's reason


@dataclass
class RuleInput:
    claim_type: str  # return | not_delivered
    claim_at: datetime
    item_name: str
    item_category: str  # occasion | everyday
    customer_orders: int
    customer_returns: int
    customer_prev_claims: int
    brand_return_rate: float  # 0..1
    otp_verified: bool
    gps_distance_m: int | None
    delivered_at: datetime | None
    linked_ids: int  # customer ids sharing this phone or address (including this one)
    linked_claims: int  # claims across those ids
    answers: Answers = field(default_factory=Answers)


def _time(dt: datetime) -> str:
    return dt.strftime("%-I:%M %p")


def r1_delivery_proof(i: RuleInput) -> Fired | None:
    if i.claim_type != "not_delivered" or i.delivered_at is None:
        return None
    near = i.gps_distance_m is not None and i.gps_distance_m <= 100
    if not (i.otp_verified or near):
        return None
    parts = []
    parts.append("OTP-verified delivery" if i.otp_verified else "Delivery scan")
    parts.append(f"at {_time(i.delivered_at)}")
    if i.gps_distance_m is not None:
        parts.append(f"{i.gps_distance_m} m from the address")
    reason = " ".join(parts[:2]) + (f", {parts[2]}" if len(parts) > 2 else "")
    return Fired("R1", 40, reason)


def r2_serial_returner(i: RuleInput) -> Fired | None:
    if i.customer_orders == 0 or i.customer_returns < 3:
        return None
    rate = i.customer_returns / i.customer_orders
    if rate < 2 * i.brand_return_rate:
        return None
    return Fired(
        "R2",
        25,
        f"Returned {i.customer_returns} of {i.customer_orders} orders ({round(rate * 100)}%) "
        f"vs brand average {round(i.brand_return_rate * 100)}%",
    )


def r3_linked_accounts(i: RuleInput) -> Fired | None:
    if i.linked_ids < 3 or i.linked_claims < 3:
        return None
    return Fired("R3", 25, f"Phone or address shared by {i.linked_ids} customer IDs with {i.linked_claims} claims")


def r4_wardrobing(i: RuleInput) -> Fired | None:
    if i.claim_type != "return" or i.item_category != "occasion":
        return None
    a = i.answers
    worn = a.tag_on is False or a.condition in ("worn", "used")
    if not worn:
        return None
    for name, day in FESTIVALS.items():
        gap = (i.claim_at.date() - day).days
        if 0 <= gap <= WARDROBING_WINDOW_DAYS:
            state = "tag is removed" if a.tag_on is False else f"it is {a.condition}"
            unit = "day" if gap == 1 else "days"
            return Fired("R4", 30, f"{i.item_name} returned {gap} {unit} after {name}; customer said the {state}")
    return None


def r5_story_mismatch(i: RuleInput) -> Fired | None:
    if i.claim_type != "not_delivered" or not i.otp_verified:
        return None
    if not i.answers.nobody_home:
        return None
    quote = i.answers.quote or "nobody was home"
    return Fired("R5", 20, f"Customer said '{quote}', delivery log shows OTP shared")


def clean_history(i: RuleInput) -> Fired | None:
    if i.customer_orders >= 10 and i.customer_prev_claims == 0:
        return Fired("CLEAN", -15, f"{i.customer_orders} orders, no previous claims")
    return None


RULES = [r1_delivery_proof, r2_serial_returner, r3_linked_accounts, r4_wardrobing, r5_story_mismatch, clean_history]


def evaluate(i: RuleInput, enabled: set[str] | None = None) -> list[Fired]:
    fired = [f for rule in RULES if (f := rule(i)) is not None]
    if enabled is not None:
        fired = [f for f in fired if f.rule_id in enabled or f.rule_id == "CLEAN"]
    return sorted(fired, key=lambda f: -f.points)


def score(fired: list[Fired]) -> int:
    return max(0, min(100, sum(f.points for f in fired)))


def level(s: int, medium: int = 30, high: int = 60) -> str:
    if s >= high:
        return "high"
    if s >= medium:
        return "medium"
    return "low"
