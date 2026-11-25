// Display helpers only: labels and dates. No risk logic lives here (scores, levels and reasons come from the API).
import type {Answers, Claim, ClaimType, Level} from "@/lib/api";

// API timestamps are naive local (IST) times, e.g. "2026-11-12T14:02:00"; JS parses these as local time.
const d = (iso: string) => new Date(iso);

export const dayMonth = (iso: string) => d(iso).toLocaleDateString("en-IN", {day: "numeric", month: "short"});
export const clock = (iso: string) =>
    d(iso).toLocaleTimeString("en-US", {hour: "numeric", minute: "2-digit"});
export const dayMonthTime = (iso: string) => `${dayMonth(iso)}, ${clock(iso)}`;

export function age(iso: string, now = Date.now()) {
    const mins = Math.max(0, Math.floor((now - d(iso).getTime()) / 60_000));
    if (mins < 60) return `${mins} m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} h`;
    return `${Math.floor(hrs / 24)} d`;
}

export const typeLabel: Record<ClaimType, string> = {return: "Return", not_delivered: "Not delivered"};
export const levelLabel: Record<Level, string> = {high: "High", medium: "Medium", low: "Low"};

export const hasAnswer = (c: Pick<Claim, "answers" | "transcript">) =>
    !!c.transcript || Object.values(c.answers ?? {}).some((v) => v !== null && v !== undefined);

export type StatusKey = "awaiting" | "answered" | "scored" | "decided";

export function statusOf(c: Claim): StatusKey {
    if (c.status === "decided") return "decided";
    if (c.status === "awaiting_customer") return "awaiting";
    return hasAnswer(c) ? "answered" : "scored";
}

export const statusMeta: Record<StatusKey, { label: string; color: string }> = {
    awaiting: {label: "Awaiting customer", color: "text-sub"},
    answered: {label: "Answered", color: "text-brand"},
    scored: {label: "Scored", color: "text-ink-2"},
    decided: {label: "Decided", color: "text-low"},
};

const LANGS: Record<string, { en: string; native: string; lang: string }> = {
    kn: {en: "Kannada", native: "ಕನ್ನಡ", lang: "kn"},
    hi: {en: "Hindi", native: "हिन्दी", lang: "hi"},
    te: {en: "Telugu", native: "తెలుగు", lang: "te"},
    ta: {en: "Tamil", native: "தமிழ்", lang: "ta"},
    ml: {en: "Malayalam", native: "മലയാളം", lang: "ml"},
    mr: {en: "Marathi", native: "मराठी", lang: "mr"},
    bn: {en: "Bengali", native: "বাংলা", lang: "bn"},
    gu: {en: "Gujarati", native: "ગુજરાતી", lang: "gu"},
    pa: {en: "Punjabi", native: "ਪੰਜਾਬੀ", lang: "pa"},
    od: {en: "Odia", native: "ଓଡ଼ିଆ", lang: "or"},
    en: {en: "English", native: "English", lang: "en"},
};

export function language(code: string | null | undefined) {
    const base = (code ?? "").split("-")[0].toLowerCase();
    return LANGS[base] ?? {en: code || "Unknown", native: code || "", lang: base || "und"};
}

const yesNo = (v: boolean) => (v ? "yes" : "no");

/** Extracted answer fields as `key = value` pairs, skipping empty ones. */
export function answerPairs(a: Answers | null): [string, string][] {
    if (!a) return [];
    return (["received_by", "nobody_home", "tag_on", "condition"] as const).flatMap((k) => {
        const v = a[k];
        if (v === null || v === undefined || v === "") return [];
        return [[k, typeof v === "boolean" ? yesNo(v) : String(v)] as [string, string]];
    });
}
