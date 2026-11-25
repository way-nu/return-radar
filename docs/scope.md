# Scope

**Core:** claim intake · rules R1–R5 with numeric reasons · one voice question + answer (Sarvam) · console queue +
detail + approve/reject · Flagsmith thresholds, kill switch, experiment · NudgeBee incident with approval.
**Simple:** typed form fallback · polling instead of live push · decision summary card from a template · one-page demo
store.
**Mocked:** one brand, no auth · customers/orders/delivery proof from the seed · no SMS (link opened directly).
**Cut (README "next steps"):** weekly loss report, ask-the-desk, photo upload, multiple brands, report translation, SSE,
Vercel.

| Rule                                                                       | Points | Reason example                                                                |
|----------------------------------------------------------------------------|--------|-------------------------------------------------------------------------------|
| R1 delivery proof contradicts "not delivered"                              | 40     | OTP-verified delivery at 2:02 PM, 40 m from the address                       |
| R2 serial returner (≥ 2× brand rate, ≥ 3 returns)                          | 25     | Returned 7 of 9 orders (78%) vs brand average 22%                             |
| R3 linked accounts (≥ 3 IDs, ≥ 3 claims)                                   | 25     | Phone or address shared by 4 customer IDs with 7 claims                       |
| R4 festive wardrobing (occasion wear, ≤ 4 days after Diwali, tag off/worn) | 30     | Banarasi Saree returned 2 days after Diwali; customer said the tag is removed |
| R5 story mismatch (says nobody home, OTP shared)                           | 20     | Customer said 'nobody was home', delivery log shows OTP shared                |
| Clean history (≥ 10 orders, 0 claims)                                      | −15    | 14 orders, no previous claims                                                 |

Thresholds default Medium ≥ 30, High ≥ 60 (Flagsmith `risk_thresholds`).
