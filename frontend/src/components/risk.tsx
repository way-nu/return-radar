import {cn} from "@/lib/utils";
import type {Fired, Level} from "@/lib/api";
import {levelLabel} from "@/lib/format";

const tone: Record<Level, { bg: string; fg: string; dot: string }> = {
    high: {bg: "bg-high-soft", fg: "text-high", dot: "bg-high"},
    medium: {bg: "bg-med-soft", fg: "text-med", dot: "bg-med-dot"},
    low: {bg: "bg-low-soft", fg: "text-low", dot: "bg-low"},
};

/** "High · 65": level and score straight from the API. */
export function RiskBadge({level, score, size = "sm"}: { level: Level; score: number; size?: "sm" | "md" }) {
    const t = tone[level];
    return (
        <span
            data-testid="risk-badge"
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full font-semibold tabular-nums whitespace-nowrap",
                size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1 text-[13px]",
                t.bg, t.fg,
            )}
        >
            <span className={cn("rounded-full", size === "sm" ? "size-1.5" : "size-[7px]", t.dot)}/>
            {levelLabel[level]} · {score}
        </span>
    );
}

/** Points chip for one fired rule: red ≥ 20, amber for smaller raises, green when it lowers risk. */
function pointsTone(p: number) {
    if (p < 0) return "bg-low-soft text-low";
    if (p < 20) return "bg-med-soft text-med";
    return "bg-high-soft text-high";
}

export const signed = (p: number) => (p > 0 ? `+${p}` : p < 0 ? `−${Math.abs(p)}` : "0");

export function ReasonRow({fired}: { fired: Fired }) {
    return (
        <div className="flex items-center gap-3.5 border-t border-line-soft py-3" data-testid="reason-row">
            <span
                className={cn("min-w-12 shrink-0 rounded-lg px-2 py-[5px] text-center text-sm font-bold tabular-nums", pointsTone(fired.points))}>
                {signed(fired.points)}
            </span>
            <span className="flex-1 text-[15px] leading-[1.45]">{fired.reason}</span>
            <code className="shrink-0 font-mono text-xs text-sub">{fired.rule_id}</code>
        </div>
    );
}

export function PendingReasonRow({children}: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3.5 border-t border-line-soft py-3">
            <span
                className="min-w-12 shrink-0 rounded-lg border border-dashed border-[#C9C9C4] px-2 py-1 text-center text-sm font-bold text-sub">…</span>
            <span className="flex-1 text-[15px] leading-[1.45] text-sub">{children}</span>
        </div>
    );
}
