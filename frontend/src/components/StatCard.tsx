import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  unit,
  icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
  hint?: React.ReactNode;
}) {
  const toneCls = {
    default: "",
    good: "text-emerald-600 dark:text-emerald-400",
    warn: "text-amber-600 dark:text-amber-400",
    bad:  "text-rose-600 dark:text-rose-400",
  }[tone];
  return (
    <div className="card flex items-start gap-3">
      <div className="text-2xl" aria-hidden>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-[rgb(var(--muted))]">{label}</div>
        <div className={cn("text-2xl font-semibold mt-0.5 truncate", toneCls)}>
          {value}{unit ? <span className="ml-1 text-base font-normal text-[rgb(var(--muted))]">{unit}</span> : null}
        </div>
        {hint ? <div className="text-xs text-[rgb(var(--muted))] mt-1">{hint}</div> : null}
      </div>
    </div>
  );
}
