"use client";

import Link from "next/link";
import {useEffect, useRef, useState} from "react";
import useSWR from "swr";
import {AlertTriangle, Check, Info, Loader2, Lock, Mic, MicOff, Pause, Play} from "lucide-react";
import {api, ApiError, type Answers, type CustomerView, fetcher, inr} from "@/lib/api";
import {language} from "@/lib/format";
import {startRecording} from "@/lib/recorder";
import {Skeleton} from "@/components/ui/skeleton";
import {cn} from "@/lib/utils";

const MAX_SECS = 30;
const MIN_MS = 700; // shorter holds are treated as a tap, not an answer

type Phase = "idle" | "recording" | "sending" | "micDenied";

export function CustomerAnswer({id}: { id: string }) {
    const key = `/api/c/${id}`;
    // Re-poll so the Flagsmith kill switch (mode: voice → form) reaches an open page.
    const {data: view, error, mutate} = useSWR<CustomerView>(key, fetcher, {refreshInterval: 10_000});
    const [done, setDone] = useState(false);
    const [chooseForm, setChooseForm] = useState(false);

    return (
        <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-canvas">
            <header
                className="flex h-[60px] shrink-0 items-center justify-center gap-2 border-b border-store-line bg-white">
                <span className="size-2 rounded-full bg-saffron"/>
                <span className="text-lg font-bold tracking-[0.01em]">{view?.brand ?? "Utsav Ethnic"}</span>
            </header>

            {error && !view ? (
                <ErrorState notFound={error instanceof ApiError && error.status === 404} retry={() => mutate()}/>
            ) : !view ? (
                <LoadingState/>
            ) : done || view.answered ? (
                <Thanks view={view}/>
            ) : (
                <>
                    <main className="flex min-h-0 flex-1 flex-col gap-4 px-5 pt-5 pb-6">
                        <p className="text-base leading-[1.45] font-medium">
                            We’re looking into your claim for the {view.item_name} (<span
                            className="tabular-nums">{inr(view.value_paise)}</span>)
                        </p>
                        {view.mode === "form" || chooseForm ? (
                            <AnswerForm
                                id={id}
                                view={view}
                                killSwitch={view.mode === "form"}
                                onBackToVoice={view.mode === "voice" ? () => setChooseForm(false) : undefined}
                                onDone={() => setDone(true)}
                            />
                        ) : (
                            <VoiceAnswer id={id} view={view} onForm={() => setChooseForm(true)}
                                         onDone={() => setDone(true)}/>
                        )}
                    </main>
                    <footer className="shrink-0 px-5 pt-3 pb-5 text-center text-xs text-sub">
                        Your answer is only used for this claim.
                    </footer>
                </>
            )}
        </div>
    );
}

function QuestionCard({view}: { view: CustomerView }) {
    const lang = language(view.language);
    const audio = useRef<HTMLAudioElement>(null);
    const [playing, setPlaying] = useState(false);
    const [audioFailed, setAudioFailed] = useState(false);

    function toggle() {
        const a = audio.current;
        if (!a) return;
        if (a.paused) a.play().catch(() => setAudioFailed(true));
        else a.pause();
    }

    return (
        <section aria-label="Question"
                 className="flex flex-col gap-3 rounded-2xl bg-white p-[18px] shadow-[0_1px_2px_rgba(23,24,26,.06)]">
            <audio ref={audio} src={view.audio_url} preload="none" onPlay={() => setPlaying(true)}
                   onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
                   onError={() => setAudioFailed(true)}/>
            <div className="flex items-center justify-between gap-2">
                {audioFailed ? (
                    <span className="text-[13px] text-sub">Audio isn’t available right now</span>
                ) : (
                    <button type="button" data-testid="play-question" onClick={toggle}
                            aria-label={playing ? "Pause the question" : "Play the question"}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full bg-saffron-soft py-1.5 pr-3.5 pl-1.5 text-sm font-semibold">
                        <span className="flex size-8 items-center justify-center rounded-full bg-saffron">
                            {playing ? <Pause className="size-3.5 fill-ink" aria-hidden/> :
                                <Play className="size-3.5 fill-ink" aria-hidden/>}
                        </span>
                        {playing ? "Pause" : "Listen"}
                    </button>
                )}
                <span
                    className="inline-flex h-8 items-center gap-1.5 rounded-full bg-store-wash px-3 text-[13px] font-semibold">
                    <span lang={lang.lang}>{lang.native}</span>
                    {lang.native !== lang.en && <span className="font-normal text-sub">· {lang.en}</span>}
                </span>
            </div>
            <p lang={lang.lang} className="text-[21px] leading-normal font-semibold">{view.question}</p>
            {view.question_en && view.question_en !== view.question && (
                <p className="text-[13px] text-sub">{view.question_en}</p>
            )}
        </section>
    );
}

function VoiceAnswer({id, view, onForm, onDone}: {
    id: string;
    view: CustomerView;
    onForm: () => void;
    onDone: () => void
}) {
    const [phase, setPhase] = useState<Phase>("idle");
    const [secs, setSecs] = useState(0);
    const [hint, setHint] = useState<string | null>(null);
    const rec = useRef<{ stop: () => Promise<Blob> } | null>(null);
    const holding = useRef(false);
    const startedAt = useRef(0);
    const tick = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearTick = () => {
        if (tick.current) clearInterval(tick.current);
        tick.current = null;
    };
    useEffect(() => clearTick, []);

    async function press() {
        if (phase !== "idle") return;
        holding.current = true;
        setHint(null);
        try {
            const r = await startRecording(MAX_SECS * 1000);
            if (!holding.current) {
                // Released while the permission prompt was open: discard and ask for a hold.
                await r.stop();
                setHint("Now press and hold the button while you speak.");
                return;
            }
            rec.current = r;
            startedAt.current = Date.now();
            setSecs(0);
            setPhase("recording");
            tick.current = setInterval(() => {
                const s = Math.floor((Date.now() - startedAt.current) / 1000);
                setSecs(Math.min(s, MAX_SECS));
                if (s >= MAX_SECS) release();
            }, 250);
        } catch (e) {
            holding.current = false;
            if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError")) setPhase("micDenied");
            else setHint("We couldn’t start the microphone. Try again, or use the form.");
        }
    }

    async function release() {
        holding.current = false;
        const r = rec.current;
        if (!r) return;
        rec.current = null;
        clearTick();
        const heldMs = Date.now() - startedAt.current;
        const blob = await r.stop();
        if (heldMs < MIN_MS) {
            setPhase("idle");
            setHint("Keep holding the button while you speak.");
            return;
        }
        setPhase("sending");
        try {
            await api.answerVoice(id, blob);
            onDone();
        } catch (e) {
            setPhase("idle");
            if (e instanceof ApiError && e.code === "audio_too_long") setHint("That was a bit long. Please keep it under 30 seconds.");
            else if (e instanceof ApiError && e.code === "stt_failed") setHint("We couldn’t hear that clearly. Please try again, or use the form.");
            else setHint("Sending failed. Please try again.");
        }
    }

    const mmss = (n: number) => `0:${String(n).padStart(2, "0")}`;

    if (phase === "micDenied") {
        return (
            <>
                <QuestionCard view={view}/>
                <section aria-label="Microphone blocked"
                         className="flex flex-col gap-3 rounded-2xl bg-white p-[18px] shadow-[0_1px_2px_rgba(23,24,26,.06)]">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-store-wash">
                            <MicOff className="size-5" aria-hidden/>
                        </span>
                        <h2 className="text-[17px] font-bold">We can’t hear you yet</h2>
                    </div>
                    <p className="text-sm leading-normal text-ink-2">Your browser has the microphone turned off for this
                        page. To turn it on:</p>
                    <ol className="list-decimal pl-5 text-sm leading-relaxed">
                        <li>Tap the <Lock className="inline size-3.5 align-[-2px]" aria-label="lock"/> next to the web
                            address
                        </li>
                        <li>Open <strong>Permissions</strong> and allow <strong>Microphone</strong></li>
                        <li>Come back here and tap <strong>Try again</strong></li>
                    </ol>
                    <button type="button" data-testid="mic-retry" onClick={() => setPhase("idle")}
                            className="h-12 cursor-pointer rounded-xl bg-saffron text-[15px] font-bold">
                        Try again
                    </button>
                    <button type="button" data-testid="mic-denied-form" onClick={onForm}
                            className="h-11 cursor-pointer text-sm font-semibold underline">
                        Answer with a quick form instead
                    </button>
                </section>
            </>
        );
    }

    return (
        <>
            <QuestionCard view={view}/>
            <section aria-label="Your answer" className="flex flex-1 flex-col items-center justify-center gap-4 pt-2">
                {phase === "sending" ? (
                    <div role="status" className="flex flex-col items-center gap-3.5">
                        <span className="flex size-[172px] items-center justify-center rounded-full bg-saffron-soft">
                            <Loader2 className="size-14 animate-spin text-med-dot" strokeWidth={2} aria-hidden/>
                        </span>
                        <span className="text-lg font-bold">Sending your answer…</span>
                        <span className="text-sm tabular-nums text-sub">{mmss(secs)} recorded</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3.5">
                        <button
                            type="button"
                            data-testid="hold-to-answer"
                            aria-label={phase === "recording" ? "Release to send" : "Hold to answer"}
                            onPointerDown={(e) => {
                                e.currentTarget.setPointerCapture?.(e.pointerId);
                                press();
                            }}
                            onPointerUp={release}
                            onPointerCancel={release}
                            onContextMenu={(e) => e.preventDefault()}
                            className={cn(
                                "flex size-[172px] cursor-pointer touch-none items-center justify-center rounded-full border-[10px] border-saffron-soft bg-saffron select-none [-webkit-touch-callout:none]",
                                phase === "recording" ? "scale-[1.04] animate-rr-pulse" : "shadow-[0_8px_24px_rgba(232,163,23,.35)]",
                            )}
                        >
                            {phase === "recording" ? (
                                <span className="flex h-12 items-center gap-[5px]" aria-hidden>
                                    {[18, 36, 48, 28, 40, 16].map((h, i) => (
                                        <span key={i} className="w-1.5 animate-pulse rounded-[3px] bg-ink"
                                              style={{height: h, animationDelay: `${i * 120}ms`}}/>
                                    ))}
                                </span>
                            ) : (
                                <Mic className="size-14" strokeWidth={1.75} aria-hidden/>
                            )}
                        </button>
                        {phase === "recording" ? (
                            <>
                                <span role="timer"
                                      className="text-[28px] font-bold tracking-[-0.01em] tabular-nums">{mmss(secs)} / {mmss(MAX_SECS)}</span>
                                <span className="h-1.5 w-[200px] overflow-hidden rounded-[3px] bg-[#ECE9E0]">
                                    <span className="block h-full rounded-[3px] bg-saffron transition-[width]"
                                          style={{width: `${(secs / MAX_SECS) * 100}%`}}/>
                                </span>
                                <span className="text-sm text-sub">Recording… release to send</span>
                            </>
                        ) : (
                            <>
                                <span className="text-lg font-bold">Hold to answer</span>
                                <span className="text-sm text-sub">Speak in any language · up to 30 seconds</span>
                            </>
                        )}
                    </div>
                )}
                {hint && (
                    <p role="alert"
                       className="flex items-start gap-2 rounded-xl bg-saffron-soft px-3.5 py-2.5 text-sm leading-[1.45]">
                        <Info className="mt-0.5 size-4 shrink-0 text-med" aria-hidden/>{hint}
                    </p>
                )}
                {phase === "idle" && (
                    <button type="button" data-testid="use-form" onClick={onForm}
                            className="min-h-11 cursor-pointer text-sm font-semibold underline">
                        Prefer to tap? Answer with a quick form
                    </button>
                )}
            </section>
        </>
    );
}

type FormState = { nobody_home: boolean | null; tag_on: boolean | null; condition: NonNullable<Answers["condition"]> | null };

const CONDITIONS = ["new", "used", "worn", "damaged"] as const;

function AnswerForm({id, view, killSwitch, onBackToVoice, onDone}: {
    id: string;
    view: CustomerView;
    killSwitch: boolean;
    onBackToVoice?: () => void;
    onDone: () => void;
}) {
    const [f, setF] = useState<FormState>({nobody_home: null, tag_on: null, condition: null});
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const any = f.nobody_home !== null || f.tag_on !== null || f.condition !== null;

    async function submit() {
        setBusy(true);
        setErr(null);
        try {
            await api.answerForm(id, {
                nobody_home: f.nobody_home,
                tag_on: f.tag_on,
                condition: f.condition,
            });
            onDone();
        } catch (e) {
            setErr(e instanceof Error ? e.message : "Sending failed. Please try again.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <form
            className="flex flex-col gap-4"
            data-testid="answer-form"
            onSubmit={(e) => {
                e.preventDefault();
                if (any) submit();
            }}
        >
            {killSwitch && (
                <div role="status"
                     className="flex items-start gap-2.5 rounded-xl bg-saffron-soft px-3.5 py-3 text-sm leading-[1.45]">
                    <Info className="mt-px size-[18px] shrink-0 text-med" aria-hidden/>
                    <span>Voice is busy right now — a quick form instead</span>
                </div>
            )}
            <p className="text-[13px] text-sub">{view.question_en}</p>
            {/* The question is "was anyone home?", so Yes means nobody_home = false. */}
            <Field label="Was anyone home to receive it?">
                <Choice on={f.nobody_home === false} testid="anyone-home-yes"
                        onClick={() => setF({...f, nobody_home: false})}>Yes</Choice>
                <Choice on={f.nobody_home === true} testid="anyone-home-no"
                        onClick={() => setF({...f, nobody_home: true})}>No</Choice>
            </Field>
            <Field label="Is the tag still on?">
                <Choice on={f.tag_on === true} testid="tag-on-yes"
                        onClick={() => setF({...f, tag_on: true})}>Yes</Choice>
                <Choice on={f.tag_on === false} testid="tag-on-no"
                        onClick={() => setF({...f, tag_on: false})}>No</Choice>
            </Field>
            <Field label="Condition">
                {CONDITIONS.map((c) => (
                    <Choice key={c} on={f.condition === c} testid={`condition-${c}`}
                            onClick={() => setF({...f, condition: c})}>
                        <span className="capitalize">{c}</span>
                    </Choice>
                ))}
            </Field>
            {err && <p role="alert" className="text-sm text-high">{err}</p>}
            <button type="submit" data-testid="form-submit" disabled={!any || busy}
                    className="h-[52px] cursor-pointer rounded-[14px] bg-saffron text-base font-bold disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? "Sending…" : "Submit"}
            </button>
            {onBackToVoice && (
                <button type="button" data-testid="back-to-voice" onClick={onBackToVoice}
                        className="min-h-11 cursor-pointer text-sm font-semibold underline">
                    Answer by voice instead
                </button>
            )}
        </form>
    );
}

function Field({label, children}: { label: string; children: React.ReactNode }) {
    return (
        <fieldset className="flex flex-col gap-2.5 rounded-xl bg-white p-4">
            <legend className="float-left w-full p-0 text-[15px] font-semibold">{label}</legend>
            <div className="grid grid-cols-2 gap-2">{children}</div>
        </fieldset>
    );
}

function Choice({on, onClick, testid, children}: {
    on: boolean;
    onClick: () => void;
    testid: string;
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            data-testid={testid}
            aria-pressed={on}
            onClick={onClick}
            className={cn("h-11 cursor-pointer rounded-[10px] text-[15px] font-semibold",
                on ? "border-2 border-saffron bg-saffron-soft" : "border border-store-border bg-white")}
        >
            {children}
        </button>
    );
}

function Thanks({view}: { view: CustomerView }) {
    return (
        <main className="flex flex-1 flex-col items-center justify-center gap-[18px] px-7 py-8 text-center"
              data-testid="thanks">
            <span className="flex size-[88px] items-center justify-center rounded-full bg-saffron-soft">
                <span className="flex size-[60px] items-center justify-center rounded-full bg-saffron">
                    <Check className="size-[30px]" strokeWidth={2.5} aria-hidden/>
                </span>
            </span>
            <h1 className="text-2xl leading-[1.3] font-bold">Thank you. We’ll update you soon.</h1>
            <p className="text-[15px] leading-normal text-sub">
                About your claim for the {view.item_name} (<span
                className="tabular-nums">{inr(view.value_paise)}</span>). You can close this page.
            </p>
            <Link href="/store"
                  className="mt-2 inline-flex h-12 items-center justify-center rounded-xl border border-[#E3E1DA] bg-white px-6 text-[15px] font-semibold">
                Back to my orders
            </Link>
        </main>
    );
}

function LoadingState() {
    return (
        <main className="flex flex-col gap-4 px-5 pt-5" aria-busy="true" aria-label="Loading">
            <Skeleton className="h-5 w-4/5 bg-[#ECECE8]"/>
            <Skeleton className="h-40 rounded-2xl bg-[#ECECE8]"/>
            <Skeleton className="mx-auto mt-8 size-[172px] rounded-full bg-[#ECECE8]"/>
        </main>
    );
}

function ErrorState({notFound, retry}: { notFound: boolean; retry: () => void }) {
    return (
        <main role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-7 text-center">
            <AlertTriangle className="size-7 text-high" aria-hidden/>
            <h1 className="text-lg font-bold">{notFound ? "This link isn’t valid" : "We couldn’t load your question"}</h1>
            <p className="text-sm text-sub">
                {notFound ? "Please check the link we sent you." : "Please check your connection and try again."}
            </p>
            {!notFound && (
                <button type="button" data-testid="customer-retry" onClick={retry}
                        className="h-11 cursor-pointer rounded-xl border border-store-border bg-white px-5 text-sm font-semibold">
                    Try again
                </button>
            )}
        </main>
    );
}
