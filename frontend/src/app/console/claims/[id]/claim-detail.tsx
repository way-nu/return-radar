"use client";

import Link from "next/link";
import {useState} from "react";
import useSWR, {useSWRConfig} from "swr";
import {toast} from "sonner";
import {AlertTriangle, Check, ChevronLeft, Clock, MessageSquare, Package, ShoppingBag, User, X} from "lucide-react";
import {api, ApiError, type ClaimDetail, fetcher, inr} from "@/lib/api";
import {
    age,
    answerPairs,
    clock,
    dayMonth,
    dayMonthTime,
    language,
    statusMeta,
    statusOf,
    typeLabel,
} from "@/lib/format";
import {PendingReasonRow, ReasonRow, RiskBadge} from "@/components/risk";
import {Skeleton} from "@/components/ui/skeleton";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";

const card = "rounded-xl border border-line bg-white";

export function ClaimDetailView({id}: { id: string }) {
    const key = `/api/claims/${id}`;
    const {data, error, isLoading, mutate} = useSWR<ClaimDetail>(key, fetcher, {refreshInterval: 3000});

    if (error && !data) {
        const notFound = error instanceof ApiError && error.status === 404;
        return (
            <>
                <BackLink/>
                <div className={cn(card, "flex flex-col items-center gap-3 px-6 py-20 text-center")} role="alert">
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-high-soft">
                        <AlertTriangle className="size-6 text-high" aria-hidden/>
                    </span>
                    <h1 className="text-lg font-semibold">{notFound ? `Claim ${id} not found` : "Couldn’t load this claim"}</h1>
                    <p className="max-w-[380px] text-sm text-sub">{notFound ? "It may have been removed, or the link is wrong." : error.message}</p>
                    {!notFound && <Button variant="outline" data-testid="claim-retry" onClick={() => mutate()}>Try again</Button>}
                </div>
            </>
        );
    }
    if (isLoading || !data) return <DetailSkeleton/>;

    const {claim, order, customer} = data;
    const status = statusMeta[statusOf(claim)];
    const awaiting = claim.status === "awaiting_customer";

    return (
        <>
            <header className="flex flex-col gap-3.5">
                <BackLink/>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h1 className="text-[26px] font-bold tracking-[-0.01em]">Claim {claim.id}</h1>
                            <span
                                className="rounded-full bg-wash px-2.5 py-1 text-xs font-medium">{typeLabel[claim.type]}</span>
                            <RiskBadge level={claim.level} score={claim.score} size="md"/>
                        </div>
                        <p className="text-[15px] text-ink-2">
                            <span className="font-semibold text-ink">
                                {order.item_name} · <span className="tabular-nums">{inr(order.value_paise)}</span>
                            </span>{" "}
                            · {customer.name} · filed {age(claim.created_at)} ago
                        </p>
                    </div>
                    <span
                        className={cn("inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-medium", status.color)}>
                        <span className="size-[7px] rounded-full bg-current"/>
                        {status.label}
                    </span>
                </div>
            </header>

            <div className="flex flex-wrap items-start gap-6">
                <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
                    <section aria-labelledby="why" className={cn(card, "flex flex-col px-6 py-5")}>
                        <div className="flex items-baseline justify-between gap-3 pb-2">
                            <h2 id="why" className="text-base font-semibold">Why this is risky</h2>
                            <span className="text-[13px] text-sub">
                                {claim.fired.length} {claim.fired.length === 1 ? "rule" : "rules"} matched
                            </span>
                        </div>
                        {claim.fired.map((f) => <ReasonRow key={f.rule_id} fired={f}/>)}
                        {awaiting && (
                            <PendingReasonRow>Customer answer not in yet. Its rules will be added when it
                                arrives.</PendingReasonRow>
                        )}
                        {claim.fired.length === 0 && !awaiting && (
                            <p className="border-t border-line-soft py-3 text-[15px] text-sub">No rules fired for this
                                claim.</p>
                        )}
                        <div
                            className="flex justify-between gap-3 border-t border-line pt-3 text-sm tabular-nums">
                            <span className="text-sub">Each row is one plain-code rule</span>
                            <span className="font-bold" data-testid="claim-score">Score {claim.score}</span>
                        </div>
                    </section>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
                        <Evidence id="ev-order" icon={<ShoppingBag/>} title="Order">
                            <KV k="Order">{order.id}</KV>
                            <KV k="Ordered">{dayMonth(order.ordered_at)}</KV>
                            <KV k="Payment"><span className="capitalize">{order.payment}</span></KV>
                            <KV k="Item">{order.item_name} · {inr(order.value_paise)}</KV>
                        </Evidence>

                        <Evidence id="ev-del" icon={<Package/>} title="Delivery proof">
                            <KV k="Delivered">{order.delivered_at ? dayMonthTime(order.delivered_at) : "Not delivered"}</KV>
                            <KV k="OTP">
                                {order.otp_verified ? (
                                    <span className="inline-flex items-center gap-1 text-low">
                                        <Check className="size-3.5" strokeWidth={2.5} aria-hidden/>Verified
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-sub">
                                        <X className="size-3.5" strokeWidth={2.5} aria-hidden/>Not verified
                                    </span>
                                )}
                            </KV>
                            <KV k="Drop point">
                                {order.gps_distance_m !== null ? `${order.gps_distance_m} m from address` : "No GPS fix"}
                            </KV>
                            {order.gps_distance_m !== null && <DropPoint metres={order.gps_distance_m}/>}
                        </Evidence>

                        <Evidence id="ev-cust" icon={<User/>} title="Customer history">
                            <KV k="Customer">{customer.name}, {customer.city}</KV>
                            <KV k="Phone">{customer.phone_masked}</KV>
                            <KV k="Orders">{customer.orders}</KV>
                            <KV k="Returns">{customer.returns}</KV>
                            <KV k="Previous claims">{customer.previous_claims}</KV>
                            <KV k="Linked IDs">{customer.linked_ids}</KV>
                        </Evidence>

                        <CustomerAnswerCard data={data}/>
                    </div>
                </div>

                <aside aria-label="Decision" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
                    {claim.status === "decided" ? (
                        <DecisionSummary data={data}/>
                    ) : (
                        <DecisionPanel data={data} onDecided={() => mutate()}/>
                    )}
                    <Timeline data={data}/>
                </aside>
            </div>
        </>
    );
}

function BackLink() {
    return (
        <Link href="/console"
              className="inline-flex items-center gap-1 self-start text-[13px] font-medium text-brand hover:text-brand-hover">
            <ChevronLeft className="size-4" aria-hidden/>Claims queue
        </Link>
    );
}

function Evidence({id, icon, title, children}: {
    id: string;
    icon: React.ReactNode;
    title: string;
    children: React.ReactNode
}) {
    return (
        <section aria-labelledby={id} className={cn(card, "px-5 py-[18px]")}>
            <h3 id={id}
                className="mb-2 flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-sub">
                {icon}{title}
            </h3>
            {children}
        </section>
    );
}

function KV({k, children}: { k: string; children: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-3 border-t border-line-soft py-[9px] text-sm">
            <span className="text-sub">{k}</span>
            <span className="text-right font-medium tabular-nums">{children}</span>
        </div>
    );
}

/** Schematic: address pin, dashed line, OTP drop pin, labelled with the API's distance. Not to scale. */
function DropPoint({metres}: { metres: number }) {
    return (
        <div role="img" aria-label={`Drop point ${metres} metres from the delivery address`}
             className="relative mt-2.5 h-16 overflow-hidden rounded-[10px] bg-wash-2">
            <span
                className="absolute top-1/2 left-[30%] -m-1.5 size-3 rounded-full bg-brand shadow-[0_0_0_6px_rgba(59,76,202,.15)]"/>
            <span className="absolute top-1/2 left-[30%] w-[40%] border-t-2 border-dashed border-[#9A9CA2]"/>
            <span
                className="absolute top-1/2 left-[70%] -m-1.5 size-3 rounded-full bg-ink-2 shadow-[0_0_0_6px_rgba(23,24,26,.1)]"/>
            <span className="absolute bottom-1.5 left-[30%] -translate-x-1/2 text-[11px] text-ink-2">Address</span>
            <span
                className="absolute top-2.5 left-1/2 -translate-x-1/2 text-[11px] font-semibold tabular-nums text-ink-2">{metres} m</span>
            <span className="absolute bottom-1.5 left-[70%] -translate-x-1/2 text-[11px] text-ink-2">OTP shared</span>
        </div>
    );
}

function CustomerAnswerCard({data}: { data: ClaimDetail }) {
    const {claim, customer} = data;
    const lang = language(claim.language ?? customer.language);
    const pairs = answerPairs(claim.answers);
    const answered = !!claim.transcript || pairs.length > 0;
    const firstName = customer.name.split(" ")[0];

    return (
        <section aria-labelledby="ev-ans" className={cn(card, "flex flex-col gap-2.5 px-5 py-[18px]")}
                 data-testid="customer-answer">
            <div className="flex items-center justify-between gap-2">
                <h3 id="ev-ans" className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="size-4 text-sub" aria-hidden/>Customer answer
                </h3>
                <span
                    className="rounded-full bg-brand-soft px-2.5 py-[3px] text-xs font-medium text-brand">{lang.en}</span>
            </div>
            {answered ? (
                <div className="flex flex-col gap-2.5">
                    {claim.transcript ? (
                        <p lang={lang.lang} className="text-base leading-relaxed">“{claim.transcript}”</p>
                    ) : (
                        <p className="text-[13px] text-sub">Answered with the form.</p>
                    )}
                    {claim.answers?.quote && claim.answers.quote !== claim.transcript && (
                        <p className="text-[13px] leading-normal text-sub">“{claim.answers.quote}”</p>
                    )}
                    {pairs.length > 0 && (
                        <div
                            className="flex items-start justify-between gap-2 border-t border-line-soft pt-2.5 text-[13px]">
                            <span className="text-sub">Extracted</span>
                            <span className="flex flex-wrap justify-end gap-1.5">
                                {pairs.map(([k, v]) => (
                                    <code key={k}
                                          className="rounded-md bg-wash-2 px-2 py-[3px] font-mono text-xs">{k} = {v}</code>
                                ))}
                            </span>
                        </div>
                    )}
                </div>
            ) : (
                <div
                    className="flex min-h-[150px] grow flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#D6D6D1] p-4 text-center">
                    <Clock className="size-[22px] text-sub" aria-hidden/>
                    {claim.status === "awaiting_customer" ? (
                        <>
                            <span className="text-sm font-semibold">Waiting for {firstName}’s answer</span>
                            <span className="text-[13px] leading-[1.45] text-sub">
                                Question sent in {lang.en} {age(claim.created_at)} ago.<br/>
                                The transcript appears here when they answer.
                            </span>
                        </>
                    ) : (
                        <span className="text-sm text-sub">No answer recorded for this claim.</span>
                    )}
                </div>
            )}
        </section>
    );
}

function DecisionPanel({data, onDecided}: { data: ClaimDetail; onDecided: () => void }) {
    const {claim, order} = data;
    const {mutate} = useSWRConfig();
    const [choice, setChoice] = useState<"approve" | "reject" | null>(null);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const can = !!choice && reason.trim().length >= 5 && !busy;

    async function decide() {
        if (!choice || !can) return;
        setBusy(true);
        try {
            await api.decide(claim.id, choice, reason.trim());
            toast.success(choice === "approve" ? "Refund approved" : "Claim rejected");
        } catch (e) {
            if (e instanceof ApiError && e.code === "already_decided") toast.error("Someone already decided this claim.");
            else toast.error(e instanceof Error ? e.message : "Decision failed");
        } finally {
            setBusy(false);
            onDecided();
            mutate("/api/claims");
        }
    }

    const seg = (on: boolean, tone: string) =>
        cn("h-10 cursor-pointer rounded-lg text-sm font-semibold",
            on ? cn("bg-white shadow-[0_1px_2px_rgba(23,24,26,.12)]", tone) : "bg-transparent text-sub hover:text-ink");

    return (
        <form
            className={cn(card, "flex flex-col gap-4 p-5")}
            data-testid="decision-form"
            onSubmit={(e) => {
                e.preventDefault();
                decide();
            }}
        >
            <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">Decision</h2>
                <span className="text-[13px] tabular-nums text-sub">Refund {inr(order.value_paise)}</span>
            </div>
            {claim.status === "awaiting_customer" && (
                <p className="rounded-lg bg-wash-2 px-3 py-2.5 text-[13px] leading-[1.45] text-sub">
                    You can decide now, or wait for the customer’s answer.
                </p>
            )}
            <div role="group" aria-label="Outcome" className="grid grid-cols-2 gap-1 rounded-[10px] bg-wash p-1">
                <button type="button" data-testid="decision-approve" aria-pressed={choice === "approve"}
                        className={seg(choice === "approve", "text-low")} onClick={() => setChoice("approve")}>
                    Approve refund
                </button>
                <button type="button" data-testid="decision-reject" aria-pressed={choice === "reject"}
                        className={seg(choice === "reject", "text-high")} onClick={() => setChoice("reject")}>
                    Reject
                </button>
            </div>
            <div className="flex flex-col gap-1.5">
                <label htmlFor="reason" className="text-[13px] font-semibold">
                    Reason <span className="font-normal text-sub">(required, 5+ characters)</span>
                </label>
                <textarea
                    id="reason"
                    data-testid="decision-reason"
                    rows={4}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="What decided it? This goes in the audit log."
                    className="resize-y rounded-[10px] border border-input px-3 py-2.5 text-sm leading-[1.45] outline-none focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20"
                />
            </div>
            <button
                type="submit"
                data-testid="decision-submit"
                disabled={!can}
                className={cn("h-11 rounded-[10px] text-[15px] font-semibold",
                    can ? "cursor-pointer bg-brand text-white hover:bg-brand-hover" : "cursor-not-allowed bg-[#E4E6F5] text-[#6B72A8]")}
            >
                {busy ? "Saving…" : "Decide"}
            </button>
            <p className="text-xs leading-[1.45] text-sub">The customer is told the outcome, never the score.</p>
        </form>
    );
}

function DecisionSummary({data}: { data: ClaimDetail }) {
    const {claim, order} = data;
    const rejected = claim.decision === "reject";
    return (
        <section className={cn(card, "flex flex-col gap-3.5 p-5")} data-testid="decision-summary">
            <div className="flex items-center gap-3">
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full",
                    rejected ? "bg-brand-soft text-brand" : "bg-low-soft text-low")}>
                    {rejected ? <X className="size-[18px]" strokeWidth={2.25} aria-hidden/> :
                        <Check className="size-[18px]" strokeWidth={2.25} aria-hidden/>}
                </span>
                <h2 className="text-base leading-[1.35] font-semibold">
                    {rejected ? "Rejected" : "Refund approved"}
                    {claim.decided_at && <> at {clock(claim.decided_at)}, {dayMonth(claim.decided_at)}</>}
                </h2>
            </div>
            {claim.decision_reason && (
                <p className="rounded-lg bg-canvas px-3 py-2.5 text-sm leading-normal text-ink-2">{claim.decision_reason}</p>
            )}
            <div>
                <KV k="Refund">{inr(order.value_paise)} {rejected ? "not issued" : "issued"}</KV>
                <KV k="Score at decision"><RiskBadge level={claim.level} score={claim.score}/></KV>
            </div>
        </section>
    );
}

function Timeline({data}: { data: ClaimDetail }) {
    const {claim, order} = data;
    const events: { at: string; time: string; text: string }[] = [];
    if (order.delivered_at)
        events.push({
            at: order.delivered_at,
            time: dayMonth(order.delivered_at),
            text: order.otp_verified ? "Delivered, OTP verified" : "Delivered"
        });
    events.push({
        at: claim.created_at,
        time: dayMonth(claim.created_at),
        text: `Claim filed: ${claim.reason_text || typeLabel[claim.type].toLowerCase()}`,
    });
    if (claim.decided_at)
        events.push({
            at: claim.decided_at,
            time: dayMonth(claim.decided_at),
            text: claim.decision === "reject" ? "Rejected by analyst" : "Refund approved by analyst",
        });
    return (
        <section className={cn(card, "flex flex-col gap-2 px-5 py-4")}>
            <h2 className="text-sm font-semibold">Timeline</h2>
            {events.map((t) => (
                <div key={t.at + t.text} className="flex gap-2.5 text-[13px] leading-[1.4]">
                    <span className="w-16 shrink-0 tabular-nums text-sub">{t.time}</span>
                    <span>{t.text}</span>
                </div>
            ))}
        </section>
    );
}

function DetailSkeleton() {
    const sk = "rounded-md bg-[#ECECE8]";
    return (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading claim">
            <div className="flex flex-col gap-3">
                <Skeleton className={cn(sk, "h-4 w-28")}/>
                <Skeleton className={cn(sk, "h-8 w-80")}/>
                <Skeleton className={cn(sk, "h-4 w-96")}/>
            </div>
            <div className="flex flex-wrap items-start gap-6">
                <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
                    <Skeleton className={cn(sk, "h-56 rounded-xl")}/>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-5">
                        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className={cn(sk, "h-48 rounded-xl")}/>)}
                    </div>
                </div>
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
                    <Skeleton className={cn(sk, "h-80 rounded-xl")}/>
                    <Skeleton className={cn(sk, "h-28 rounded-xl")}/>
                </div>
            </div>
        </div>
    );
}
