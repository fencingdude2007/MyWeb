import { useQuery } from "@tanstack/react-query";

import { Spinner } from "../components/ui";
import { api } from "../lib/api";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-900 bg-neutral-950 p-4">
      <p className="text-2xl font-semibold text-neutral-100">{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

function BarList({ items }: { items: { name: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.name} className="flex items-center gap-3 text-sm">
          <span className="w-40 truncate text-neutral-300">{item.name}</span>
          <div className="h-2 flex-1 rounded bg-neutral-900">
            <div
              className="h-2 rounded bg-indigo-600"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-neutral-500">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityChart({ days }: { days: { day: string; count: number }[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  return (
    <div className="flex h-24 items-end gap-1">
      {days.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.count}`}
          className="flex-1 rounded-t bg-indigo-600/80 hover:bg-indigo-500"
          style={{ height: `${(d.count / max) * 100}%`, minHeight: 2 }}
        />
      ))}
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
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          onClick={downloadExport}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-900"
        >
          Export my data
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Saved pages" value={stats.total_pages} />
        <StatCard label="Searchable" value={stats.ready_pages} />
        <StatCard label="Favorites" value={stats.favorite_pages} />
        <StatCard label="Collections" value={stats.total_collections} />
        <StatCard label="Notes" value={stats.total_notes} />
      </div>

      {stats.saves_per_day.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">
            Saves — last 30 days
          </h2>
          <ActivityChart days={stats.saves_per_day} />
        </div>
      )}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {stats.top_tags.length > 0 && (
          <div>
            <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">Top topics</h2>
            <BarList items={stats.top_tags} />
          </div>
        )}
        {stats.top_sites.length > 0 && (
          <div>
            <h2 className="mb-3 text-xs uppercase tracking-wide text-neutral-500">Top sites</h2>
            <BarList items={stats.top_sites} />
          </div>
        )}
      </div>
    </div>
  );
}
