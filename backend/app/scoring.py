"""Builds RuleInput from the database and scores a claim. All numbers come from SQL here."""

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import rules
from app.db import Claim, Customer, Order


async def brand_return_rate(s: AsyncSession, tenant_id: str) -> float:
    total = await s.scalar(select(func.count()).select_from(Order).where(Order.tenant_id == tenant_id))
    returned = await s.scalar(
        select(func.count()).select_from(Order).where(Order.tenant_id == tenant_id, Order.returned.is_(True))
    )
    return (returned or 0) / total if total else 0.0


async def build_input(s: AsyncSession, claim: Claim) -> rules.RuleInput:
    order = await s.get(Order, claim.order_id)
    cust = await s.get(Customer, claim.customer_id)
    n_orders = await s.scalar(select(func.count()).select_from(Order).where(Order.customer_id == cust.id))
    n_returns = await s.scalar(
        select(func.count()).select_from(Order).where(Order.customer_id == cust.id, Order.returned.is_(True))
    )
    prev_claims = await s.scalar(
        select(func.count()).select_from(Claim).where(Claim.customer_id == cust.id, Claim.id != claim.id)
    )
    linked = (
        await s.scalars(
            select(Customer.id).where(
                Customer.tenant_id == cust.tenant_id,
                or_(Customer.phone == cust.phone, Customer.address == cust.address),
            )
        )
    ).all()
    linked_claims = await s.scalar(select(func.count()).select_from(Claim).where(Claim.customer_id.in_(linked)))
    a = claim.answers or {}
    return rules.RuleInput(
        claim_type=claim.type,
        claim_at=claim.created_at,
        item_name=order.item_name,
        item_category=order.category,
        customer_orders=n_orders or 0,
        customer_returns=n_returns or 0,
        customer_prev_claims=prev_claims or 0,
        brand_return_rate=await brand_return_rate(s, cust.tenant_id),
        otp_verified=order.otp_verified,
        gps_distance_m=order.gps_distance_m,
        delivered_at=order.delivered_at,
        linked_ids=len(linked),
        linked_claims=linked_claims or 0,
        answers=rules.Answers(**{k: a.get(k) for k in ("received_by", "nobody_home", "tag_on", "condition", "quote")}),
    )


async def score_claim(s: AsyncSession, claim: Claim, cfg: dict) -> None:
    inp = await build_input(s, claim)
    fired = rules.evaluate(inp, set(cfg["rules_enabled"]))
    claim.fired = [{"rule_id": f.rule_id, "points": f.points, "reason": f.reason} for f in fired]
    claim.score = rules.score(fired)
    t = cfg["risk_thresholds"]
    claim.level = rules.level(claim.score, t["medium"], t["high"])
