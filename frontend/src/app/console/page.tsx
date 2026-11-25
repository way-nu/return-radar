"use client";

import Link from "next/link";
import {useMemo, useState} from "react";
import useSWR from "swr";
import {AlertTriangle, Check, Search} from "lucide-react";
import {type Claim, fetcher, inr, type Level} from "@/lib/api";
import {age, statusMeta, statusOf, typeLabel} from "@/lib/format";
import {RiskBadge, signed} from "@/components/risk";
import {Skeleton} from "@/components/ui/skeleton";
import {Button} from "@/components/ui/button";
import {cn} from "@/lib/utils";

type Filter = "all" | Level;
const CHIPS: { key: Filter; label: string }[] = [
    {key: "all", label: "All"},
    {key: "high", label: "High"},
    {key: "medium", label: "Medium"},
    {key: "low", label: "Low"},
];

export default function QueuePage() {
    const {data, error, isLoading, mutate} = useSWR<{ items: Claim[] }>("/api/claims", fetcher, {
        refreshInterval: 3000,
    });
    const [filter, setFilter] = useState<Filter>("all");
    const [q, setQ] = useState("");

    const items = data?.items;
    // KPIs are counts and sums of API values only; no risk is computed here.
    const kpis = useMemo(() => {
        if (!items) return null;
        const open = items.filter((c) => c.status !== "decided");
        return {
            open: open.length,
            high: open.filter((c) => c.level === "high").length,
            atStake: open.reduce((s, c) => s + (c.value_paise ?? 0), 0),
        };
    }, [items]);

    // API order (by score) is kept; filters only hide rows.
    const rows = useMemo(() => {
        const needle = q.trim().toLowerCase();
        return (items ?? []).filter(
            (c) =>
                (filter === "all" || c.level === filter) &&
                (!needle || [c.id, c.customer_id, c.item_name ?? "", c.order_id].some((s) => s.toLowerCase().includes(needle))),
        );
    }, [items, filter, q]);

    const loading = isLoading && !data;

    return (
        <>
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold tracking-[-0.01em]">Claims queue</h1>
                    <p className="text-sm text-sub">Return and “not delivered” claims waiting for a refund decision</p>
                </div>
                <label
                    className="flex h-10 w-[280px] max-w-full items-center gap-2 rounded-xl border border-line-strong bg-white px-3">
                    <Search className="size-4 text-sub" aria-hidden/>
                    <span className="sr-only">Search claims</span>
                    <input
                        type="search"
                        data-testid="queue-search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search claim, customer or item"
                        className="w-full bg-transparent text-sm outline-none placeholder:text-sub"
                    />
                </label>
            </header>

            <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                <Kpi label="Open claims" loading={loading} width="w-16">{kpis?.open}</Kpi>
                <Kpi
                    label={<><span className="size-2 rounded-full bg-high"/>High risk</>}
                    loading={loading}
                    width="w-12"
                >
                    {kpis?.high}
                </Kpi>
                <Kpi label="₹ at stake" loading={loading} width="w-36" accent>
                    {kpis ? inr(kpis.atStake) : null}
                </Kpi>
            </section>

            <section aria-label="Claims" className="flex flex-col rounded-xl border border-line bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div role="group" aria-label="Filter by risk" className="flex flex-wrap gap-2">
                        {CHIPS.map((chip) => {
                            const on = chip.key === filter;
                            return (
                                <button
                                    key={chip.key}
                                    type="button"
                                    data-testid={`filter-${chip.key}`}
                                    aria-pressed={on}
                                    onClick={() => setFilter(chip.key)}
                                    className={cn(
                                        "h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold",
                                        on ? "border-brand bg-brand text-white" : "border-line-strong bg-white text-ink hover:bg-canvas",
                                    )}
                                >
                                    {chip.label}
                                </button>
                            );
                        })}
                    </div>
                    <span className="text-[13px] text-sub">Sorted by risk score</span>
                </div>

                {error && !data ? (
                    <div
                        className="flex flex-col items-center gap-3 border-t border-line px-6 py-20 text-center"
                        role="alert">
                        <span className="flex size-14 items-center justify-center rounded-2xl bg-high-soft">
                            <AlertTriangle className="size-6 text-high" aria-hidden/>
                        </span>
                        <h2 className="text-lg font-semibold">Couldn’t load claims</h2>
                        <p className="max-w-[380px] text-sm text-sub">{error.message || "The API did not respond."}</p>
                        <Button variant="outline" data-testid="queue-retry" onClick={() => mutate()}>Try again</Button>
                    </div>
                ) : !loading && items && items.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 border-t border-line px-6 py-24 text-center">
                        <span className="flex size-14 items-center justify-center rounded-2xl bg-low-soft">
                            <Check className="size-[26px] text-low" aria-hidden/>
                        </span>
                        <h2 className="text-lg font-semibold">No open claims</h2>
                        <p className="max-w-[380px] text-sm text-sub">
                            New return and “not delivered” claims appear here as customers file them.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1060px] border-collapse" data-testid="claims-table">
                                <thead>
                                <tr>
                                    <Th>Claim</Th>
                                    <Th>Customer</Th>
                                    <Th>Type</Th>
                                    <Th>Item</Th>
                                    <Th right>Value</Th>
                                    <Th>Risk</Th>
                                    <Th>Top reason</Th>
                                    <Th>Status</Th>
                                    <Th right>Age</Th>
                                </tr>
                                </thead>
                                <tbody>
                                {loading
                                    ? Array.from({length: 6}, (_, i) => <SkeletonRow key={i}/>)
                                    : rows.map((c) => <ClaimRow key={c.id} c={c}/>)}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-4 py-3.5 text-[13px] text-sub">
                            {loading
                                ? "Loading claims…"
                                : `Showing ${rows.length} of ${items?.length ?? 0} claims`}
                        </div>
                    </>
                )}
            </section>
        </>
    );
}

function Kpi({label, loading, width, accent, children}: {
    label: React.ReactNode;
    loading: boolean;
    width: string;
    accent?: boolean;
    children: React.ReactNode;
}) {
    return (
        <div
            className={cn("flex flex-col gap-2 rounded-xl border bg-white p-5", accent ? "border-brand-line" : "border-line")}>
            <span className="flex items-center gap-1.5 text-[13px] text-sub">{label}</span>
            {loading ? (
                <Skeleton className={cn("h-8 rounded-md bg-[#ECECE8]", width)}/>
            ) : (
                <span
                    className={cn("font-bold tracking-[-0.02em] tabular-nums", accent ? "text-[34px] leading-tight text-brand" : "text-[30px] leading-tight")}>
                    {children ?? "—"}
                </span>
            )}
        </div>
    );
}

function Th({children, right}: { children: React.ReactNode; right?: boolean }) {
    return (
        <th scope="col"
            className={cn("whitespace-nowrap border-b border-line px-3 py-3 text-xs font-medium text-sub first:pl-4 last:pr-4", right ? "text-right" : "text-left")}>
            {children}
        </th>
    );
}

const td = "whitespace-nowrap border-b border-line-soft px-3 py-4 align-middle text-sm first:pl-4 last:pr-4";

function ClaimRow({c}: { c: Claim }) {
    const status = statusMeta[statusOf(c)];
    const top = c.fired[0];
    return (
        <tr className="hover:bg-[#FAFAF8]" data-testid={`claim-row-${c.id}`}>
            <td className={td}>
                <Link href={`/console/claims/${c.id}`}
                      className="font-semibold text-brand hover:text-brand-hover">{c.id}</Link>
            </td>
            <td className={td}>{c.customer_id}</td>
            <td className={td}>
                <span className="rounded-full bg-wash px-2.5 py-1 text-xs font-medium">{typeLabel[c.type]}</span>
            </td>
            <td className={td}>{c.item_name ?? c.order_id}</td>
            <td className={cn(td, "text-right font-semibold tabular-nums")}>
                {c.value_paise !== undefined ? inr(c.value_paise) : "—"}
            </td>
            <td className={td}><RiskBadge level={c.level} score={c.score}/></td>
            <td className={cn(td, "text-ink-2")} title={top ? `${signed(top.points)} ${top.reason}` : undefined}>
                {top ? (
                    <span className="block max-w-[230px] truncate">
                        <span className="font-semibold tabular-nums">{signed(top.points)}</span> {top.reason}
                    </span>
                ) : (
                    <span className="text-sub">No rules fired</span>
                )}
            </td>
            <td className={td}>
                <span className={cn("inline-flex items-center gap-1.5 text-[13px]", status.color)}>
                    <span className="size-1.5 rounded-full bg-current"/>
                    {status.label}
                </span>
            </td>
            <td className={cn(td, "text-right tabular-nums text-sub")}>{age(c.created_at)}</td>
        </tr>
    );
}

function SkeletonRow() {
    const sk = "block h-3.5 rounded-md bg-[#ECECE8]";
    return (
        <tr>
            <td className={td}><Skeleton className={cn(sk, "w-22")}/></td>
            <td className={td}><Skeleton className={cn(sk, "w-26")}/></td>
            <td className={td}><Skeleton className={cn(sk, "h-[22px] w-23 rounded-full")}/></td>
            <td className={td}><Skeleton className={cn(sk, "w-24")}/></td>
            <td className={td}><Skeleton className={cn(sk, "ml-auto w-14")}/></td>
            <td className={td}><Skeleton className={cn(sk, "h-[22px] w-19 rounded-full")}/></td>
            <td className={td}><Skeleton className={cn(sk, "w-65")}/></td>
            <td className={td}><Skeleton className={cn(sk, "w-28")}/></td>
            <td className={td}><Skeleton className={cn(sk, "ml-auto w-7")}/></td>
        </tr>
    );
}
