# ReturnRadar — Claude Design brief

Ask Claude Design: "Design these 4 screens as artboards — console screens at 1440×900, phone screens at 390×844 —
using the tokens below, with the sample data given. Include the listed states. Export as JSX." Budget: 30 minutes.

## Product

ReturnRadar checks a D2C brand's return and "not delivered" claims before a refund. Plain-code rules score each claim
and say why, with exact numbers; the customer answers one short voice question in their own language; an analyst
approves or rejects. Brand in the demo: **Utsav Ethnic** (ethnic wear), the Monday after Diwali.

## Feel

Console: calm, credible, numbers-first (think Razorpay or Linear dashboards), never a red-alert "fraud" look.
Customer pages: warm and respectful; the customer never sees a score and must not feel accused.

## Tokens

Background #F7F7F5 · Surface #FFFFFF · Text #17181A · Muted #5F6368 · Primary #3B4CCA · High #C2362B · Medium #C27803 ·
Low #1F7A4D · Customer accent (phone screens only) #E8A317. Font Inter, tabular numbers for money; Noto Sans
Kannada/Devanagari/Telugu fallbacks. Radius 12. Icons lucide. Money format ₹4,999 (Indian grouping).

## 1. Console — claims queue (1440)

- Left sidebar: logo "ReturnRadar", nav Queue (active), brand chip "Utsav Ethnic".
- KPI strip: Open claims 14 · High risk 3 · ₹ at stake ₹48,690 (largest).
- Filter chips: All · High · Medium · Low.
- Table columns: Claim, Customer, Type (chip: Return / Not delivered), Item, Value, Risk (badge "High · 85"),
  Top reason (one line, truncated), Status (Awaiting customer / Answered / Decided), Age.
- Rows (sample): demo-ravi · Ravi Kumar · Not delivered · Silk Lehenga · ₹4,999 · High 85 · "OTP-verified delivery at
  2:02 PM, 40 m from the address" · Answered · 2 h | demo-linked · Naveen Rao · Not delivered · Cotton Kurta · ₹999 ·
  High 65 · "Phone or address shared by 4 customer IDs with 7 claims" | demo-ananya · Ananya Rao · Return · Banarasi
  Saree · ₹6,899 · Medium 30 · "Banarasi Saree returned 2 days after Diwali; customer said the tag is removed" |
  demo-meera · Meera Sharma · Return · Palazzo Set · ₹1,499 · Low 0 · "14 orders, no previous claims".
- States: empty ("No open claims"), loading skeleton rows.

## 2. Console — claim detail (1440) — the hero screen

- Header: back link, "Claim demo-ravi", Not delivered chip, risk badge "High · 85", item "Silk Lehenga · ₹4,999".
- Left column, card "Why this is risky": rows with points chip + sentence:
  +40 OTP-verified delivery at 2:02 PM, 40 m from the address · +25 Returned 7 of 9 orders (78%) vs brand average 22% ·
  +20 Customer said 'nobody was home', delivery log shows OTP shared. Show a negative example style too (−15 green).
- Evidence cards (2×2): Order (O-50001, ordered 9 Nov, prepaid) · Delivery proof (Delivered 12 Nov, 2:02 PM, OTP
  verified ✓, 40 m from address) · Customer history (Ravi Kumar, Bengaluru, 9 orders, 7 returns, 1 previous claim,
  linked IDs 1) · Customer answer (language chip "Kannada", transcript in Kannada + English line, extracted: nobody home
  = yes).
- Right column, Decision panel: Approve refund / Reject (segmented), reason textarea (required), Decide button.
  After deciding: a summary card "Rejected by Analyst at 3:41 PM — OTP-verified delivery 40 m from the address".
- State: "Awaiting customer answer" (answer card shows a waiting state).

## 3. Customer — answer page (390)

- Header "Utsav Ethnic", line "We're looking into your claim for the Silk Lehenga (₹4,999)".
- Question card: play button, question text in Kannada, small English line below, language chip.
- Big round hold-to-answer button (accent), label "Hold to answer", recording state with timer "0:07 / 0:30",
  sending state, thanks state "Thank you. We'll update you within 24 hours."
- Form variant (voice paused): banner "Voice is busy right now — a quick form instead", fields: Was anyone home to
  receive it? (Yes/No), Is the tag still on? (Yes/No), Condition (New / Used / Worn / Damaged), Submit.
- Mic-denied state with how to allow.

## 4. Demo store (390)

- "Utsav Ethnic" header, "My orders" for Ravi Kumar: Silk Lehenga ₹4,999 (Delivered 12 Nov), Cotton Kurta ₹999,
  Anarkali Kurta ₹2,499.
- Order sheet: "Report a problem" → two options "I want to return it" / "It never arrived" → optional note → Submit →
  "We've sent you a quick question" and a button "Answer now".
