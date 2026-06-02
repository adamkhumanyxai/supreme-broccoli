import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Play, Pause, Square, RotateCcw, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/demo-interview")({
  component: DemoInterview,
});

type ScriptTurn = {
  role: "interviewer" | "candidate";
  text: string;
  tip?: string; // shown after candidate turns
};

// The gold-standard interview. Bill asks, your clone answers.
const SCRIPT: ScriptTurn[] = [
  {
    role: "interviewer",
    text: "Great to meet you. To kick things off — can you walk me through your background and what's drawing you to this opportunity?",
  },
  {
    role: "candidate",
    text: "Great to meet you too. I've spent the last six years building products at the intersection of data and user experience — most recently as a senior engineer at a Series B fintech where I led the team that built our real-time risk scoring system. What draws me here is the scale of the problem you're solving, and the fact that this role sits right at that same intersection. I've done my homework on your product, and the technical challenges around latency at your scale are genuinely interesting to me. I'm at a point in my career where I want those harder problems.",
    tip: "Leads with a clear narrative, drops a specific credential, and ties personal interest to concrete research. No waffling.",
  },
  {
    role: "interviewer",
    text: "Tell me about a time you had to push back on a product decision you disagreed with.",
  },
  {
    role: "candidate",
    text: "Yeah, this happened about two years ago. My PM wanted to ship a feature that would surface user transaction data in a new dashboard — great idea, but the implementation plan would have required us to bypass our data anonymisation layer for performance reasons. I flagged the risk immediately, but there was pressure from leadership because it was tied to a big client renewal. Rather than just saying no, I put together a two-page technical brief that quantified the risk — we estimated a regulatory fine exposure of around two million dollars — alongside an alternative implementation that would only add about three weeks to the timeline. Leadership read it, we had a proper conversation, and we went with the safer path. The feature shipped five weeks later and it's now one of our most-used dashboards. The lesson I took: pushback without a better answer rarely lands. You have to bring the alternative.",
    tip: "STAR method, quantified impact, showed maturity. Didn't just complain — brought a solution and still shipped the thing.",
  },
  {
    role: "interviewer",
    text: "Last one from me — what do you want to be true about your career in five years?",
  },
  {
    role: "candidate",
    text: "Honestly, in five years I want to have shipped something that a lot of people use every day and actually care about. That sounds simple, but it's harder than it sounds. I'd like to have led a team by that point — not because management is the only path, but because the leverage of making other engineers better is something I want to develop. And I want to still be learning. The thing that worries me most about career progression is getting comfortable. If I'm not uncomfortable at least some of the time, I'm probably not growing. So: impact, people leadership, and staying curious.",
    tip: "Specific, ambitious without arrogance. Tied leadership desire to leverage, not prestige. Ended with a value, not a title.",
  },
  {
    role: "interviewer",
    text: "Really well said. Do you have any questions for me before we wrap up?",
  },
  {
    role: "candidate",
    text: "A few. What does success look like for this role in the first ninety days — and how do you tell the difference between someone who's on track versus someone who's quietly struggling? Second — how does the team honestly think about technical debt? Not the official answer, but how much sprint capacity actually goes to it? And the last one: what surprised you most about working here — the thing that didn't show up in the job description?",
    tip: "Three sharp questions that signal preparation, cultural curiosity, and self-awareness. The 'not the official answer' framing builds instant trust.",
  },
];

function DemoInterview() {
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "done">("idle");
  const [visibleTurns, setVisibleTurns] = useState<number[]>([]);
  const [activeTurn, setActiveTurn] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const audioCacheRef = useRef<Map<number, string>>(new Map());
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);
  const pausedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Blocks the playback loop while paused (and bails out immediately if stopped).
  const waitWhilePaused = useCallback(async () => {
    while (pausedRef.current && !abortRef.current) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }, []);

  const getAudio = useCallback(async (index: number): Promise<string | null> => {
    if (audioCacheRef.current.has(index)) return audioCacheRef.current.get(index)!;
    const { data: { session } } = await supabase.auth.getSession();
    const jwt = session?.access_token;
    if (!jwt) return null;
    try {
      const res = await fetch("/api/demo-tts", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: SCRIPT[index]!.text, role: SCRIPT[index]!.role }),
      });
      if (!res.ok) return null;
      const { audio_b64 } = await res.json() as { audio_b64?: string };
      if (audio_b64) audioCacheRef.current.set(index, audio_b64);
      return audio_b64 ?? null;
    } catch {
      return null;
    }
  }, []);

  const playBase64 = useCallback((b64: string): Promise<void> => {
    return new Promise((resolve) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      if (!audioElRef.current) {
        const el = document.createElement("audio");
        el.style.display = "none";
        document.body.appendChild(el);
        audioElRef.current = el;
      }
      const el = audioElRef.current;
      el.src = url;
      el.onended = () => { URL.revokeObjectURL(url); resolve(); };
      el.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      el.play().catch(() => resolve());
    });
  }, []);

  const runDemo = useCallback(async () => {
    abortRef.current = false;
    setStatus("loading");
    setVisibleTurns([]);
    setActiveTurn(null);
    audioCacheRef.current.clear();

    // Preload first two turns before starting
    const [first] = await Promise.all([getAudio(0), getAudio(1)]);
    if (!first || abortRef.current) { setStatus("idle"); return; }

    setStatus("playing");

    for (let i = 0; i < SCRIPT.length; i++) {
      await waitWhilePaused();
      if (abortRef.current) break;

      // Prefetch next turn in the background
      if (i + 1 < SCRIPT.length) void getAudio(i + 1);
      if (i + 2 < SCRIPT.length) void getAudio(i + 2);

      setActiveTurn(i);
      setIsAnimating(true);

      // Wait for audio to be ready (it's usually cached by now)
      let b64 = audioCacheRef.current.get(i) ?? null;
      let attempts = 0;
      while (!b64 && attempts < 30 && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 300));
        b64 = audioCacheRef.current.get(i) ?? null;
        attempts++;
      }

      await waitWhilePaused();
      if (b64 && !abortRef.current) {
        await playBase64(b64);
      }

      setIsAnimating(false);
      setActiveTurn(null);
      setVisibleTurns((t) => [...t, i]);

      // Scroll transcript into view
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      }, 50);

      // Brief pause between turns
      if (i < SCRIPT.length - 1 && !abortRef.current) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    if (!abortRef.current) setStatus("done");
  }, [getAudio, playBase64, waitWhilePaused]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    setIsPaused(true);
    audioElRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    setIsPaused(false);
    // Only resume the clip if we paused mid-playback (not during an inter-turn gap).
    const el = audioElRef.current;
    if (el && el.src && el.paused && !el.ended && el.currentTime < el.duration) {
      el.play().catch(() => undefined);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current = true;
    pausedRef.current = false;
    setIsPaused(false);
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.src = ""; }
    setStatus("idle");
    setVisibleTurns([]);
    setActiveTurn(null);
    setIsAnimating(false);
  }, []);

  const replay = useCallback(() => {
    abortRef.current = true;
    pausedRef.current = false;
    setIsPaused(false);
    if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current.src = ""; }
    setTimeout(() => runDemo(), 100);
  }, [runDemo]);

  const interviewerLabel = "SC"; // Standard Corp
  const candidateLabel = "You";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-serif text-2xl text-foreground">Demo Interview</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground max-w-lg">
            This is how the pros do it. Watch a model interview — Bill asks, you answer. Each response shows exactly why it works.
          </p>
        </div>
        {status === "idle" && (
          <Button size="lg" onClick={runDemo} className="shrink-0">
            <Play className="mr-2 h-4 w-4" /> Play demo
          </Button>
        )}
        {status === "loading" && (
          <Button size="lg" disabled className="shrink-0">
            <span className="mr-2 h-4 w-4 inline-flex gap-0.5 items-center">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
            </span>
            Preparing…
          </Button>
        )}
        {status === "playing" && (
          <div className="flex shrink-0 items-center gap-2">
            {isPaused ? (
              <Button size="lg" onClick={resume}>
                <Play className="mr-2 h-4 w-4" /> Resume
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={pause}>
                <Pause className="mr-2 h-4 w-4" /> Pause
              </Button>
            )}
            <Button size="lg" variant="outline" onClick={stop} aria-label="Stop demo">
              <Square className="mr-2 h-4 w-4" /> Stop
            </Button>
          </div>
        )}
        {status === "done" && (
          <Button size="lg" variant="outline" onClick={replay} className="shrink-0">
            <RotateCcw className="mr-2 h-4 w-4" /> Replay
          </Button>
        )}
      </div>

      {/* Speakers */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-sm font-medium text-primary transition-all ${
            activeTurn !== null && SCRIPT[activeTurn]?.role === "interviewer" && isAnimating && !isPaused
              ? "ring-2 ring-primary animate-pulse scale-105"
              : ""
          }`}>
            {interviewerLabel}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Bill</p>
            <p className="text-xs text-muted-foreground">Senior Interviewer</p>
          </div>
        </div>
        <div className="flex-1 mx-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full bg-primary transition-all duration-100 ${
                activeTurn !== null && isAnimating && !isPaused ? "animate-[level_0.4s_ease-in-out_infinite]" : ""
              }`}
              style={{ width: activeTurn !== null && isAnimating ? "60%" : "0%" }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-foreground text-right">You</p>
            <p className="text-xs text-muted-foreground text-right">Candidate</p>
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-sm font-medium text-amber-600 dark:text-amber-400 transition-all ${
            activeTurn !== null && SCRIPT[activeTurn]?.role === "candidate" && isAnimating && !isPaused
              ? "ring-2 ring-amber-500 animate-pulse scale-105"
              : ""
          }`}>
            {candidateLabel}
          </div>
        </div>
      </div>

      {/* Transcript + tips */}
      {(visibleTurns.length > 0 || activeTurn !== null) && (
        <div ref={scrollRef} className="max-h-[56vh] overflow-y-auto space-y-4 pr-1">
          {/* Completed turns */}
          {visibleTurns.map((i) => {
            const turn = SCRIPT[i]!;
            return (
              <div key={i} className="space-y-2">
                <div className={`flex gap-3 ${turn.role === "candidate" ? "flex-row-reverse" : ""}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                    turn.role === "interviewer"
                      ? "bg-primary/15 text-primary"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}>
                    {turn.role === "interviewer" ? interviewerLabel : candidateLabel}
                  </div>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    turn.role === "candidate"
                      ? "bg-amber-500/10 text-foreground border border-amber-500/20"
                      : "bg-card text-foreground border border-border"
                  }`}>
                    <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                      {turn.role === "interviewer" ? "Bill" : "You"}
                    </span>
                    {turn.text}
                  </div>
                </div>
                {turn.tip && (
                  <div className="ml-11 flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">Why it works: </span>
                      {turn.tip}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Currently speaking turn (no tip yet) */}
          {activeTurn !== null && (
            <div className={`flex gap-3 ${SCRIPT[activeTurn]!.role === "candidate" ? "flex-row-reverse" : ""}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                SCRIPT[activeTurn]!.role === "interviewer"
                  ? "bg-primary/15 text-primary"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
              }`}>
                {SCRIPT[activeTurn]!.role === "interviewer" ? interviewerLabel : candidateLabel}
              </div>
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                SCRIPT[activeTurn]!.role === "candidate"
                  ? "bg-amber-500/10 text-foreground border border-amber-500/20"
                  : "bg-card text-foreground border border-border"
              }`}>
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  {SCRIPT[activeTurn]!.role === "interviewer" ? "Bill" : "You"}
                </span>
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Idle state placeholder */}
      {status === "idle" && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 py-16 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Press Play to watch how it's done.</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Bill asks the questions. Your voice clone shows the way.</p>
        </div>
      )}

      {/* Done banner */}
      {status === "done" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-6 py-5 text-center space-y-2">
          <p className="font-medium text-foreground">That's how it's done.</p>
          <p className="text-sm text-muted-foreground">
            STAR method, quantified impact, sharp questions at the end. Now go run a real mock.
          </p>
          <Button className="mt-2" onClick={replay} variant="outline" size="sm">
            <RotateCcw className="mr-2 h-3.5 w-3.5" /> Watch again
          </Button>
        </div>
      )}
    </div>
  );
}
