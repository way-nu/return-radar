"use client";

import Link from "next/link";
import useSWR from "swr";
import {Inbox, Radar} from "lucide-react";
import {type Claim, fetcher} from "@/lib/api";

/** Console frame: sidebar (logo, Queue with open count, brand workspace) + main column. Desktop-first (1440). */
export function ConsoleShell({children}: { children: React.ReactNode }) {
    // Same key as the queue, so SWR dedupes: one request feeds both.
    const {data} = useSWR<{ items: Claim[] }>("/api/claims", fetcher, {refreshInterval: 3000});
    const open = data?.items.filter((c) => c.status !== "decided").length;

    return (
        <div className="flex min-h-screen flex-wrap bg-canvas text-ink">
            <aside
                className="flex flex-[1_1_232px] flex-col gap-7 border-r border-line bg-white px-4 py-6 lg:sticky lg:top-0 lg:h-screen lg:max-w-[232px]">
                <div className="flex items-center gap-2.5 px-2">
                    <span className="flex size-8 items-center justify-center rounded-[9px] bg-brand">
                        <Radar className="size-[18px] text-white" aria-hidden/>
                    </span>
                    <span className="text-[17px] font-bold tracking-[-0.01em]">ReturnRadar</span>
                </div>
                <nav aria-label="Main" className="flex grow flex-col gap-1">
                    <Link
                        href="/console"
                        aria-current="page"
                        className="flex items-center gap-2.5 rounded-[10px] bg-brand-soft px-3 py-2.5 text-sm font-semibold text-brand"
                    >
                        <Inbox className="size-[18px]" aria-hidden/>
                        Queue
                        {open !== undefined && (
                            <span
                                className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums">{open}</span>
                        )}
                    </Link>
                </nav>
                <div className="flex items-center gap-2.5 rounded-xl border border-line p-2.5">
                    <span
                        className="flex size-8 items-center justify-center rounded-lg bg-saffron-soft text-xs font-bold text-med">UE</span>
                    <span className="flex flex-col">
                        <span className="text-[13px] font-semibold">Utsav Ethnic</span>
                        <span className="text-xs text-sub">Brand workspace</span>
                    </span>
                </div>
            </aside>
            <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-6 px-10 pt-8 pb-10">{children}</main>
        </div>
    );
}
