from datetime import datetime

from app.rules import Answers, RuleInput, evaluate, level, score


def base(**kw) -> RuleInput:
    d = dict(
        claim_type="not_delivered",
        claim_at=datetime(2026, 11, 18, 10, 0),
        item_name="Silk Lehenga",
        item_category="occasion",
        customer_orders=9,
        customer_returns=7,
        customer_prev_claims=2,
        brand_return_rate=0.22,
        otp_verified=True,
        gps_distance_m=40,
        delivered_at=datetime(2026, 11, 12, 14, 2),
        linked_ids=1,
        linked_claims=0,
    )
    d.update(kw)
    return RuleInput(**d)


def reasons(i, enabled=None):
    return {f.rule_id: f.reason for f in evaluate(i, enabled)}


def test_demo_claim_is_high_with_exact_reasons():
    i = base(answers=Answers(nobody_home=True, quote="nobody was home"))
    r = reasons(i)
    assert r["R1"] == "OTP-verified delivery at 2:02 PM, 40 m from the address"
    assert r["R2"] == "Returned 7 of 9 orders (78%) vs brand average 22%"
    assert r["R5"] == "Customer said 'nobody was home', delivery log shows OTP shared"
    s = score(evaluate(i))
    assert s == 85 and level(s) == "high"


def test_r1_not_for_returns_or_far_unverified_delivery():
    assert "R1" not in reasons(base(claim_type="return"))
    assert "R1" not in reasons(base(otp_verified=False, gps_distance_m=850))
    assert "R1" in reasons(base(otp_verified=False, gps_distance_m=100))


def test_r2_boundary():
    assert "R2" not in reasons(base(customer_orders=10, customer_returns=2))
    assert "R2" not in reasons(base(customer_orders=10, customer_returns=4, brand_return_rate=0.22))
    assert "R2" in reasons(base(customer_orders=10, customer_returns=5, brand_return_rate=0.22))


def test_r3_linked_accounts():
    assert reasons(base(linked_ids=4, linked_claims=6))["R3"] == "Phone or address shared by 4 customer IDs with 6 claims"
    assert "R3" not in reasons(base(linked_ids=2, linked_claims=6))


def test_r4_wardrobing_window():
    i = base(claim_type="return", claim_at=datetime(2026, 11, 10, 9), answers=Answers(tag_on=False))
    assert reasons(i)["R4"] == "Silk Lehenga returned 2 days after Diwali; customer said the tag is removed"
    assert "R4" not in reasons(base(claim_type="return", claim_at=datetime(2026, 11, 20), answers=Answers(tag_on=False)))
    assert "R4" not in reasons(base(claim_type="return", claim_at=datetime(2026, 11, 10), answers=Answers(tag_on=True)))


def test_clean_history_lowers_score():
    i = base(claim_type="return", customer_orders=14, customer_returns=1, customer_prev_claims=0)
    r = reasons(i)
    assert r["CLEAN"] == "14 orders, no previous claims"
    assert level(score(evaluate(i))) == "low"


def test_thresholds_move_level():
    assert level(85, medium=30, high=90) == "medium"


def test_disabled_rule_is_skipped():
    assert "R2" not in reasons(base(), enabled={"R1", "R3", "R4", "R5"})
