import { cn } from "@/lib/utils";

const STYLES: Record<string, string> = {
  prospecting: "bg-zinc-800 text-zinc-300 ring-zinc-700",
  interviewing: "bg-amber-950/60 text-amber-300 ring-amber-900/60",
  offer: "bg-emerald-950/60 text-emerald-300 ring-emerald-900/60",
  closed: "bg-rose-950/60 text-rose-300 ring-rose-900/60",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ring-1 ring-inset",
        STYLES[status] ?? STYLES.prospecting,
        className,
      )}
    >
      {status}
    </span>
  );
}

export const JOB_STATUSES = ["prospecting", "interviewing", "offer", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
