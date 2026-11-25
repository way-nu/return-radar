"""Seed synthetic data for one brand (Utsav Ethnic) with planted patterns. Run: uv run python -m scripts.seed --reset

Planted patterns (the demo depends on them):
- C-1042 Ravi Kumar (Kannada): 9 orders, 7 returned; O-50001 Silk Lehenga delivered with OTP 40 m away -> R1, R2 (+R5 by voice)
- C-2001..C-2004 share one phone and address, 6 past claims between them -> R3
- C-3101 Ananya Rao: Banarasi saree delivered before Diwali, return on 10 Nov -> R4 when she says the tag is off
- C-2207 Meera Sharma (Hindi): 14 orders, no claims -> clean history, Low
"""

import argparse
import asyncio
import random
import uuid
from datetime import datetime, timedelta

from app.db import Base, Claim, Customer, Order, Session, engine
from app.flags import get_config
from app.scoring import score_claim

T = "utsav"
rng = random.Random(42)
ITEMS = [("Silk Lehenga", "occasion", 499900), ("Banarasi Saree", "occasion", 689900), ("Anarkali Kurta", "occasion", 249900),
         ("Cotton Kurta", "everyday", 99900), ("Palazzo Set", "everyday", 149900), ("Dupatta", "everyday", 59900),
         ("Sherwani", "occasion", 899900), ("Nehru Jacket", "occasion", 199900)]
CITIES = [("Bengaluru", "kn-IN"), ("Hyderabad", "te-IN"), ("Delhi", "hi-IN"), ("Mumbai", "hi-IN"), ("Mysuru", "kn-IN")]
NAMES = ["Arjun", "Priya", "Rahul", "Sneha", "Vikram", "Kavya", "Rohit", "Divya", "Karthik", "Pooja", "Aditya",
         "Neha", "Suresh", "Lakshmi", "Manoj", "Asha", "Naveen", "Ritu", "Sanjay", "Deepa"]
SURNAMES = ["Reddy", "Sharma", "Iyer", "Gupta", "Nair", "Patel", "Rao", "Singh", "Menon", "Joshi"]
n_order = 50001


def order(cust: Customer, item=None, ordered=None, returned=False, otp=True, dist=None) -> Order:
    global n_order
    name, cat, val = item or rng.choice(ITEMS)
    ordered = ordered or datetime(2026, 8, 1) + timedelta(days=rng.randint(0, 100), hours=rng.randint(8, 20))
    day = (ordered + timedelta(days=rng.randint(2, 5))).date()
    delivered = datetime(day.year, day.month, day.day, rng.randint(9, 19), rng.randint(0, 59))
    o = Order(id=f"O-{n_order}", tenant_id=T, customer_id=cust.id, item_name=name, category=cat, value_paise=val,
              payment=rng.choice(["prepaid", "cod"]), ordered_at=ordered, returned=returned, delivered_at=delivered,
              otp_verified=otp, gps_distance_m=dist if dist is not None else rng.randint(5, 120))
    n_order += 1
    return o


def customer(cid, name, city, lang, phone=None, address=None) -> Customer:
    return Customer(id=cid, tenant_id=T, name=name, city=city, language=lang,
                    phone=phone or f"9{rng.randint(100000000, 999999999)}",
                    address=address or f"{rng.randint(1, 400)}, {rng.choice(['MG Road', 'Main St', '2nd Cross', 'Lake View'])}, {city}")


async def main(reset: bool) -> None:
    async with engine.begin() as conn:
        if reset:
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    rows: list = []
    claims: list[Claim] = []

    # Demo hero: C-1042
    ravi = customer("C-1042", "Ravi Kumar", "Bengaluru", "kn-IN", phone="9845011999")
    rows.append(ravi)
    lehenga = order(ravi, ("Silk Lehenga", "occasion", 499900), ordered=datetime(2026, 11, 9, 11, 20), dist=40)
    lehenga.delivered_at = datetime(2026, 11, 12, 14, 2)
    rows.append(lehenga)
    for k in range(8):
        rows.append(order(ravi, returned=k < 7))

    # Linked accounts: one phone and address, four IDs, six past claims
    addr = "14, 3rd Cross, Whitefield, Bengaluru"
    for k in range(4):
        c = customer(f"C-200{k + 1}", f"{rng.choice(NAMES)} {rng.choice(SURNAMES)}", "Bengaluru", "kn-IN",
                     phone="9845011223", address=addr)
        rows.append(c)
        for j in range(3):
            o = order(c, returned=j == 0)
            rows.append(o)
            if j < 2 and len([x for x in claims if x.customer_id.startswith("C-200")]) < 6:
                claims.append(Claim(id=uuid.uuid4().hex[:10], tenant_id=T, order_id=o.id, customer_id=c.id,
                                    type="not_delivered", status="decided", decision="approve",
                                    decision_reason="Refunded before ReturnRadar", created_at=o.delivered_at + timedelta(days=3),
                                    decided_at=o.delivered_at + timedelta(days=4)))

    # Wardrobing: C-3101
    ananya = customer("C-3101", "Ananya Rao", "Mysuru", "kn-IN")
    rows.append(ananya)
    saree = order(ananya, ("Banarasi Saree", "occasion", 689900), ordered=datetime(2026, 11, 1, 10))
    saree.delivered_at = datetime(2026, 11, 5, 16, 30)
    rows.append(saree)
    rows += [order(ananya, returned=k == 0) for k in range(3)]

    # Clean history: C-2207
    meera = customer("C-2207", "Meera Sharma", "Delhi", "hi-IN")
    rows.append(meera)
    rows += [order(meera) for _ in range(14)]

    # Everyone else: ~55 customers, brand return rate around 20%
    for n in range(55):
        city, lang = rng.choice(CITIES)
        c = customer(f"C-{4000 + n}", f"{rng.choice(NAMES)} {rng.choice(SURNAMES)}", city, lang)
        rows.append(c)
        rows += [order(c, returned=rng.random() < 0.18) for _ in range(rng.randint(2, 7))]

    async with Session() as s:
        s.add_all(rows)
        await s.flush()
        s.add_all(claims)
        await s.flush()
        # Open claims so the queue is never empty
        cfg = get_config()
        open_claims = [
            Claim(id="demo-ravi", tenant_id=T, order_id=lehenga.id, customer_id="C-1042", type="not_delivered",
                  reason_text="Parcel never arrived", created_at=datetime(2026, 11, 18, 10, 5)),
            Claim(id="demo-ananya", tenant_id=T, order_id=saree.id, customer_id="C-3101", type="return",
                  reason_text="Colour not as shown", status="scored", created_at=datetime(2026, 11, 10, 9, 15),
                  answers={"tag_on": False, "condition": "worn", "quote": "I wore it once"}, language="kn-IN",
                  transcript="Tag tegedu haakidde, ondu sala haakonde."),
            Claim(id="demo-meera", tenant_id=T, order_id=[r for r in rows if isinstance(r, Order) and r.customer_id == "C-2207"][0].id,
                  customer_id="C-2207", type="return", reason_text="Size too small", status="scored",
                  answers={"tag_on": True, "condition": "new"}, created_at=datetime(2026, 11, 17, 18, 40)),
        ]
        others = [r for r in rows if isinstance(r, Order) and r.customer_id.startswith("C-4")]
        for o in rng.sample(others, 9):
            open_claims.append(Claim(id=uuid.uuid4().hex[:10], tenant_id=T, order_id=o.id, customer_id=o.customer_id,
                                     type=rng.choice(["return", "return", "not_delivered"]), reason_text="",
                                     status="scored", answers={}, created_at=datetime(2026, 11, rng.randint(10, 19), rng.randint(9, 21))))
        linked_order = [r for r in rows if isinstance(r, Order) and r.customer_id == "C-2003"][2]
        open_claims.append(Claim(id="demo-linked", tenant_id=T, order_id=linked_order.id, customer_id="C-2003",
                                 type="not_delivered", status="scored", answers={}, created_at=datetime(2026, 11, 19, 12)))
        s.add_all(open_claims)
        await s.flush()
        for c in open_claims:
            await score_claim(s, c, cfg)
        await s.commit()
    print(f"Seeded {sum(isinstance(r, Customer) for r in rows)} customers, {sum(isinstance(r, Order) for r in rows)} orders, "
          f"{len(claims) + len(open_claims)} claims")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--reset", action="store_true")
    asyncio.run(main(p.parse_args().reset))
