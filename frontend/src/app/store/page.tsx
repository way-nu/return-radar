"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import useSWR from "swr";
import {AlertTriangle, Check, ChevronRight, PackageX, RotateCcw, Shirt, ShoppingBag, X} from "lucide-react";
import {api, type ClaimType, fetcher, inr} from "@/lib/api";
import {dayMonth} from "@/lib/format";
import {Skeleton} from "@/components/ui/skeleton";
import {cn} from "@/lib/utils";

const CUSTOMER = "C-1042";
const KEY = `/api/demo/orders?customer_id=${CUSTOMER}`;

interface Order {
    id: string;
    item_name: string;
    value_paise: number;
    ordered_at: string;
    delivered_at: string | null;
    returned: boolean;
}

interface DemoOrders {
    customer: { id: string; name: string; city: string; language: string };
    orders: Order[];
}

const THUMBS = ["bg-[#F6E7E9]", "bg-[#E8EEF6]", "bg-[#EEF3E6]", "bg-[#F3EDE4]", "bg-[#ECE8F4]"];

type Sheet =
    | { step: "report"; order: Order }
    | { step: "note"; order: Order; type: ClaimType }
    | { step: "sent"; order: Order; link: string };

export default function StorePage() {
    const {data, error, isLoading, mutate} = useSWR<DemoOrders>(KEY, fetcher);
    const [sheet, setSheet] = useState<Sheet | null>(null);

    return (
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-canvas">
            <header
                className="sticky top-0 z-10 flex h-[60px] shrink-0 items-center justify-between border-b border-store-line bg-white px-4">
                <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-saffron"/>
                    <span className="text-lg font-bold tracking-[0.01em]">Utsav Ethnic</span>
                </span>
                <span className="flex size-11 items-center justify-center" aria-hidden>
                    <ShoppingBag className="size-[22px]" strokeWidth={1.75}/>
                </span>
            </header>

            <main className="flex flex-1 flex-col gap-4 px-4 py-5">
                <div className="flex flex-col gap-0.5">
                    <h1 className="text-2xl font-bold">My orders</h1>
                    {data ? <span className="text-sm text-sub">{data.customer.name}</span> :
                        <Skeleton className="h-4 w-24 bg-[#ECECE8]"/>}
                </div>

                {error && !data ? (
                    <div role="alert"
                         className="flex flex-col items-center gap-3 rounded-[14px] border border-store-line bg-white px-5 py-10 text-center">
                        <AlertTriangle className="size-6 text-high" aria-hidden/>
                        <p className="text-[15px] font-semibold">We couldn’t load your orders</p>
                        <button type="button" data-testid="store-retry" onClick={() => mutate()}
                                className="h-11 rounded-xl border border-store-border bg-white px-5 text-sm font-semibold">
                            Try again
                        </button>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-2.5">
                        {isLoading || !data
                            ? [0, 1, 2].map((i) => (
                                <li key={i}
                                    className="flex items-center gap-3.5 rounded-[14px] border border-store-line bg-white p-3">
                                    <Skeleton className="h-[72px] w-16 rounded-[10px] bg-[#ECECE8]"/>
                                    <span className="flex flex-1 flex-col gap-2">
                                        <Skeleton className="h-4 w-32 bg-[#ECECE8]"/>
                                        <Skeleton className="h-3.5 w-16 bg-[#ECECE8]"/>
                                    </span>
                                </li>
                            ))
                            : data.orders.map((o, i) => (
                                <li key={o.id}>
                                    <button
                                        type="button"
                                        data-testid={`order-${o.id}`}
                                        onClick={() => setSheet({step: "report", order: o})}
                                        className="flex w-full cursor-pointer items-center gap-3.5 rounded-[14px] border border-store-line bg-white p-3 text-left"
                                    >
                                        <span
                                            className={cn("flex h-[72px] w-16 shrink-0 items-center justify-center rounded-[10px]", THUMBS[i % THUMBS.length])}>
                                            <Shirt className="size-6 opacity-55" strokeWidth={1.5} aria-hidden/>
                                        </span>
                                        <span className="flex flex-1 flex-col gap-[3px]">
                                            <span className="text-[15px] font-semibold">{o.item_name}</span>
                                            <span className="text-sm tabular-nums text-ink-2">{inr(o.value_paise)}</span>
                                            <OrderStatus o={o}/>
                                        </span>
                                        <ChevronRight className="size-[18px] text-sub" aria-hidden/>
                                    </button>
                                </li>
                            ))}
                    </ul>
                )}
            </main>

            {sheet && <ReportSheet sheet={sheet} setSheet={setSheet}/>}
        </div>
    );
}

function OrderStatus({o}: { o: Order }) {
    if (o.returned) return <span className="text-[13px] text-sub">Returned</span>;
    if (!o.delivered_at) return <span className="text-[13px] text-sub">On the way</span>;
    return (
        <span className="inline-flex items-center gap-[5px] text-[13px] text-low">
            <span className="size-1.5 rounded-full bg-low"/>Delivered {dayMonth(o.delivered_at)}
        </span>
    );
}

const CHOICES: { type: ClaimType; label: string; icon: React.ReactNode }[] = [
    {type: "return", label: "I want to return it", icon: <RotateCcw className="size-[18px]" aria-hidden/>},
    {type: "not_delivered", label: "It never arrived", icon: <PackageX className="size-[18px]" aria-hidden/>},
];

function ReportSheet({sheet, setSheet}: { sheet: Sheet; setSheet: (s: Sheet | null) => void }) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const close = () => setSheet(null);
    const o = sheet.order;

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [setSheet]);

    async function submit(type: ClaimType) {
        setBusy(true);
        setErr(null);
        try {
            const r = await api.createClaim(o.id, type, note.trim());
            setSheet({step: "sent", order: o, link: r.customer_link});
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-20 flex flex-col justify-end bg-[rgba(23,24,26,0.42)]" onClick={close}>
            <section
                role="dialog"
                aria-modal="true"
                aria-label={`${o.item_name} order`}
                onClick={(e) => e.stopPropagation()}
                className="mx-auto flex w-full max-w-[430px] flex-col gap-[18px] rounded-t-[22px] bg-white px-5 pt-2.5 pb-7"
            >
                <span className="h-[5px] w-10 self-center rounded-[3px] bg-store-border"/>
                <div className="flex items-center gap-3">
                    <span className="size-12 shrink-0 rounded-[10px] bg-[#F6E7E9]"/>
                    <span className="flex flex-1 flex-col gap-0.5">
                        <span className="text-[15px] font-semibold">
                            {o.item_name} · <span className="tabular-nums">{inr(o.value_paise)}</span>
                        </span>
                        <span className="text-[13px] text-sub">
                            {o.delivered_at ? `Delivered ${dayMonth(o.delivered_at)}` : `Ordered ${dayMonth(o.ordered_at)}`}
                        </span>
                    </span>
                    <button type="button" aria-label="Close" data-testid="sheet-close" onClick={close}
                            className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-store-wash">
                        <X className="size-[18px]" aria-hidden/>
                    </button>
                </div>

                {sheet.step === "report" && (
                    <div className="flex flex-col gap-3">
                        <h2 className="text-xl font-bold">Report a problem</h2>
                        {CHOICES.map((c) => (
                            <button
                                key={c.type}
                                type="button"
                                data-testid={`report-${c.type}`}
                                onClick={() => setSheet({step: "note", order: o, type: c.type})}
                                className="flex min-h-16 cursor-pointer items-center gap-3.5 rounded-[14px] border border-store-border bg-white px-4 text-left text-base font-semibold"
                            >
                                <span
                                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-saffron-soft">{c.icon}</span>
                                {c.label}
                            </button>
                        ))}
                    </div>
                )}

                {sheet.step === "note" && (
                    <form
                        className="flex flex-col gap-3.5"
                        data-testid="report-form"
                        onSubmit={(e) => {
                            e.preventDefault();
                            submit(sheet.type);
                        }}
                    >
                        <div
                            className="flex items-center justify-between gap-3 rounded-xl bg-saffron-soft px-3.5 py-1">
                            <span className="text-[15px] font-semibold">
                                {CHOICES.find((c) => c.type === sheet.type)?.label}
                            </span>
                            <button type="button" data-testid="report-change"
                                    onClick={() => setSheet({step: "report", order: o})}
                                    className="min-h-11 cursor-pointer text-sm font-semibold underline">
                                Change
                            </button>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="note" className="text-sm font-semibold">
                                Anything we should know? <span className="font-normal text-sub">(optional)</span>
                            </label>
                            <textarea
                                id="note"
                                data-testid="report-note"
                                rows={3}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add a note"
                                className="resize-none rounded-xl border border-store-border p-3 text-[15px] leading-[1.45] outline-none focus-visible:border-saffron"
                            />
                        </div>
                        {err && <p role="alert" className="text-sm text-high">{err}</p>}
                        <button
                            type="submit"
                            data-testid="report-submit"
                            disabled={busy}
                            className="h-[52px] cursor-pointer rounded-[14px] bg-saffron text-base font-bold disabled:opacity-60"
                        >
                            {busy ? "Sending…" : "Submit"}
                        </button>
                    </form>
                )}

                {sheet.step === "sent" && (
                    <div className="flex flex-col items-center gap-3 pt-1 text-center">
                        <span className="flex size-14 items-center justify-center rounded-full bg-saffron">
                            <Check className="size-[26px]" strokeWidth={2.5} aria-hidden/>
                        </span>
                        <h2 className="text-xl font-bold">We’ve sent you a quick question</h2>
                        <p className="text-[15px] leading-normal text-sub">
                            One short question, in your language. You can answer by voice.
                        </p>
                        <Link
                            href={sheet.link}
                            data-testid="answer-now"
                            className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-saffron text-base font-bold"
                        >
                            Answer now
                        </Link>
                        <button type="button" data-testid="answer-later" onClick={close}
                                className="min-h-11 cursor-pointer text-sm font-semibold text-sub">
                            Later
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
