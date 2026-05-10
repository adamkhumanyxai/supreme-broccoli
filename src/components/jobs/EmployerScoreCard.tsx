import { CheckCircle2, XCircle, AlertTriangle, Banknote, TrendingUp, MapPin, Star } from "lucide-react";
import type { EmployerBrand } from "@/lib/insights.functions";

function scoreColor(s: number) {
  if (s >= 8) return "text-emerald-500";
  if (s >= 6) return "text-amber-500";
  return "text-destructive";
}

function scoreBg(s: number) {
  if (s >= 8) return "bg-emerald-500/10 border-emerald-500/30";
  if (s >= 6) return "bg-amber-500/10 border-amber-500/30";
  return "bg-destructive/10 border-destructive/30";
}

function scoreBar(s: number) {
  if (s >= 8) return "bg-emerald-500";
  if (s >= 6) return "bg-amber-500";
  return "bg-destructive";
}

function scoreLabel(s: number) {
  if (s >= 8.5) return "Excellent place to work";
  if (s >= 7) return "Good place to work";
  if (s >= 5.5) return "Mixed reviews";
  if (s >= 4) return "Below average";
  return "Significant concerns";
}

export function EmployerScoreCard({
  id,
  brand,
}: {
  id: string;
  brand: EmployerBrand;
}) {
  return (
    <section id={id} className="editorial-card scroll-mt-20 space-y-6 p-6 md:p-8">
      {/* Section header — matches DossierSection style */}
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Star className="h-4 w-4" />
        </span>
        <h2 className="font-serif text-2xl text-foreground">Employer Score</h2>
      </div>

      {/* Score + rationale */}
      <div className="flex items-start gap-4">
        <div className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-3 ${scoreBg(brand.score)}`}>
          <span className={`text-3xl font-bold tabular-nums ${scoreColor(brand.score)}`}>
            {brand.score.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground">/10</span>
        </div>
        <div className="flex-1 pt-1">
          <p className={`font-semibold ${scoreColor(brand.score)}`}>{scoreLabel(brand.score)}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{brand.score_rationale}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${scoreBar(brand.score)}`}
              style={{ width: `${brand.score * 10}%` }}
            />
          </div>
        </div>
      </div>

      {/* Pros / Cons */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            What employees love
          </p>
          <ul className="space-y-2">
            {brand.pros.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Common complaints
          </p>
          <ul className="space-y-2">
            {brand.cons.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Comp / equity / remote row */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-4">
        <div className="flex items-center gap-1.5 text-sm">
          <Banknote className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">Comp:</span>
          <span className="font-medium text-foreground">{brand.compensation_verdict}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">Equity:</span>
          <span className="font-medium text-foreground">{brand.equity}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="font-medium text-foreground">{brand.remote_policy}</span>
        </div>
      </div>

      {/* Perks */}
      {brand.perks.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Notable perks
          </p>
          <div className="flex flex-wrap gap-2">
            {brand.perks.map((p, i) => (
              <span
                key={i}
                className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-foreground"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Red flags */}
      {brand.red_flags.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Watch out for
            </p>
          </div>
          <ul className="space-y-1.5">
            {brand.red_flags.map((f, i) => (
              <li key={i} className="text-sm text-foreground">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Verdict */}
      <div className="border-t border-border pt-4">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Verdict
        </p>
        <p className="text-sm italic leading-relaxed text-foreground">{brand.verdict}</p>
      </div>
    </section>
  );
}
