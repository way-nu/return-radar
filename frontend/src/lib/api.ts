// Typed client for the ReturnRadar API (see docs/api.md). Screens use these through SWR; nothing else calls fetch.

export type Level = "low" | "medium" | "high";
export type ClaimType = "return" | "not_delivered";

export interface Fired {
    rule_id: string;
    points: number;
    reason: string
}

export interface Answers {
    received_by?: string | null;
    nobody_home?: boolean | null;
    tag_on?: boolean | null;
    condition?: string | null;
    quote?: string | null
}

export interface Claim {
    id: string;
    order_id: string;
    customer_id: string;
    type: ClaimType;
    reason_text: string;
    status: "awaiting_customer" | "scored" | "decided";
    score: number;
    level: Level;
    fired: Fired[];
    answers: Answers | null;
    transcript: string | null;
    language: string | null;
    question_style: string | null;
    decision: "approve" | "reject" | null;
    decision_reason: string | null;
    decided_at: string | null;
    created_at: string;
    item_name?: string;
    value_paise?: number;
}

export interface ClaimDetail {
    claim: Claim;
    order: {
        id: string; item_name: string; category: string; value_paise: number; payment: string; ordered_at: string;
        delivered_at: string | null; otp_verified: boolean; gps_distance_m: number | null
    };
    customer: {
        id: string; name: string; city: string; language: string; phone_masked: string; orders: number;
        returns: number; previous_claims: number; linked_ids: number
    };
    brand_return_rate: number;
}

export interface CustomerView {
    brand: string;
    item_name: string;
    value_paise: number;
    type: ClaimType;
    language: string;
    question: string;
    question_en: string;
    audio_url: string;
    mode: "voice" | "form";
    question_style: string;
    answered: boolean;
}

export interface Config {
    risk_thresholds: { medium: number; high: number };
    rules_enabled: string[];
    fact_finding_mode: "voice" | "form";
    question_style: string
}

export class ApiError extends Error {
    constructor(public code: string, public status: number, detail: string) {
        super(detail);
    }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const r = await fetch(path, init);
    if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new ApiError(b.error ?? "http_error", r.status, b.detail ?? r.statusText);
    }
    return r.json() as Promise<T>;
}

const json = (body: unknown): RequestInit => ({
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body)
});

export const fetcher = <T, >(path: string) => req<T>(path);
export const api = {
    createClaim: (order_id: string, type: ClaimType, reason_text = "") =>
        req<{ claim: Claim; customer_link: string }>("/api/claims", json({order_id, type, reason_text})),
    decide: (id: string, action: "approve" | "reject", reason: string) => req<Claim>(`/api/claims/${id}/decision`, json({
        action,
        reason
    })),
    answerVoice: (id: string, audio: Blob) => {
        const f = new FormData();
        f.append("audio", audio, audio.type.includes("mp4") ? "answer.mp4" : "answer.webm");
        return req<{ ok: true }>(`/api/c/${id}/answer`, {method: "POST", body: f});
    },
    answerForm: (id: string, a: Answers) => req<{ ok: true }>(`/api/c/${id}/form`, json(a)),
};
// SWR keys: "/api/claims", `/api/claims/${id}`, `/api/c/${id}`, "/api/config", "/api/demo/orders?customer_id=C-1042"

export const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", {style: "currency", currency: "INR", maximumFractionDigits: 0}).format(paise / 100);
