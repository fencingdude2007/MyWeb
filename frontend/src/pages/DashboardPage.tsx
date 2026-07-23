import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";

import { Spinner, focusRing } from "../components/ui";
import { Reveal } from "../lib/motion";
import { cn } from "../lib/utils";
import { api } from "../lib/api";

/** Animate a number from 0 → value once, respecting reduced motion. */
function useCountUp(value: number, duration = 900) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);

  return display;
}

function StatCard({ label, value }: { label: string; value: number }) {
  const shown = useCountUp(value);
  return (
    <div className="glass card-hover rounded-2xl p-4">
      <p className="text-2xl font-semibold tabular-nums text-neutral-100">{shown}</p>
      <p className="mt-0.5 text-xs text-neutral-400">{label}</p>
    </div>
  );
}

function BarList({ items }: { items: { name: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={item.name} className="flex items-center gap-3 text-sm">
          <span className="w-40 truncate text-neutral-300">{item.name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="bar-grow h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              style={{
                width: `${(item.count / max) * 100}%`,
                animationDelay: `${i * 70}ms`,
              }}
            />
          </div>
          <span className="w-8 text-right tabular-nums text-neutral-400">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });

function ActivityChart({ days }: { days: { day: string; count: number }[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  const total = days.reduce((sum, d) => sum + d.count, 0);
  return (
    <div>
      <div className="flex h-24 items-end gap-1">
        {days.map((d, i) => (
          <div
            key={d.day}
            title={`${fmtDay(d.day)} — ${d.count} page${d.count === 1 ? "" : "s"} saved`}
            className="bar-grow-up flex-1 rounded-t bg-gradient-to-t from-indigo-600/70 to-violet-500 transition-opacity hover:opacity-80"
            style={{
              height: `${(d.count / max) * 100}%`,
              minHeight: 2,
              animationDelay: `${i * 20}ms`,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{fmtDay(days[0].day)}</span>
        <span className="text-neutral-400">
          Each bar is one day — taller means more pages saved
        </span>
        <span>{fmtDay(days[days.length - 1].day)}</span>
      </div>
      <p className="mt-1 text-center text-xs text-neutral-500">
        {total} page{total === 1 ? "" : "s"} saved in this period · busiest day: {max}
      </p>
    </div>
  );
}

async function downloadExport() {
  const data = await api.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "myweb-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["stats"], queryFn: api.stats });

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <button
          onClick={downloadExport}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-neutral-200 transition-colors hover:bg-white/10",
            focusRing,
          )}
        >
          <Download className="h-4 w-4" /> Export my data
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Saved pages", value: stats.total_pages },
          { label: "Searchable", value: stats.ready_pages },
          { label: "Favorites", value: stats.favorite_pages },
          { label: "Collections", value: stats.total_collections },
          { label: "Notes", value: stats.total_notes },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 60}>
            <StatCard label={s.label} value={s.value} />
          </Reveal>
        ))}
      </div>

      {stats.saves_per_day.length > 0 && (
        <Reveal className="mt-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
            Pages saved per day — last 30 days
          </h2>
          <div className="glass rounded-2xl p-4">
            <ActivityChart days={stats.saves_per_day} />
          </div>
        </Reveal>
      )}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {stats.top_tags.length > 0 && (
          <Reveal>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Top topics
            </h2>
            <BarList items={stats.top_tags} />
          </Reveal>
        )}
        {stats.top_sites.length > 0 && (
          <Reveal delay={80}>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
              Top sites
            </h2>
            <BarList items={stats.top_sites} />
          </Reveal>
        )}
      </div>
    </div>
  );
}
