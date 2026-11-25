@AGENTS.md

# Frontend — rules for agents

Read when: any screen. Skip when: backend or infra only.

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 · lucide-react · SWR.
shadcn/ui is not installed yet: first task, run `npx shadcn@latest init -d` then
`npx shadcn@latest add button card badge table input textarea dialog sonner skeleton tabs`.
Next 16 differs from older versions: read `AGENTS.md` and the guide it points to before writing code.

## Commands

`npm run dev` (port 3000; `API_ORIGIN` defaults to http://localhost:8000) · `npx next typegen && npx tsc --noEmit` (
typegen creates the `LayoutProps`/`PageProps` globals on a fresh checkout) · `npm run build`

## Screens (bare minimum: these four, nothing else)

| Route                  | Screen                | Notes                                                                                                                                                                                                                                                                                                                                                                                                |
|------------------------|-----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `/console`             | Claims queue          | KPI strip (open claims, high risk, ₹ at stake = sum of open claim values), table sorted by score: id, customer, type, item + value, risk badge (level · score), top reason, status. Filter chips by level. Poll every 3 s (`refreshInterval: 3000`)                                                                                                                                                  |
| `/console/claims/[id]` | Claim detail          | Header: type, risk badge, ₹ value. Left: "Why this is risky" = every fired rule as `+40 reason` (negative points shown too); evidence cards: Order, Delivery proof (OTP ✓, time, distance), Customer history (orders, returns, previous claims, linked IDs), Customer answer (language, transcript, extracted answers). Right: Approve / Reject with a required reason, then a decision summary card |
| `/c/[id]`              | Customer page (phone) | Brand header, item and value, question text (customer's language + small English line), play button (`<audio src={audio_url}>`), big hold-to-answer button (`src/lib/recorder.ts`), thanks state. If `mode === "form"`: 3-field form instead (nobody home yes/no, tag on yes/no, condition). Poll `/api/c/[id]` every 10 s for mode                                                                  |
| `/store`               | Demo store (phone)    | "Utsav Ethnic", orders of C-1042 from `/api/demo/orders`, "Report a problem" → Return / Not delivered → `api.createClaim` → navigate to the returned `customer_link`                                                                                                                                                                                                                                 |

## Rules

- Data only through `src/lib/api.ts` + SWR. Money only via `inr()`. Never compute risk in the UI.
- Every screen has loading (skeleton) and error states. `data-testid` on buttons and forms.
- Port the look from `design/` at the repo root, i.e. `../design/` from here (Claude Design export). Missing state →
  build it plainly with shadcn.
- Mobile-first for `/c` and `/store` (390 px); console is desktop (1440 px).
