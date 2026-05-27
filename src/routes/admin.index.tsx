import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BedDouble,
  ArrowRightLeft,
  Coins,
  Building2,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatXCD, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const metrics = useQuery({
    queryKey: ["admin", "metrics"],
    queryFn: async () => {
      const [rooms, redirects, properties, earnings] = await Promise.all([
        supabase.from("rooms").select("id", { count: "exact", head: true }).eq("available", true),
        supabase
          .from("redirects")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "pending", "matched"]),
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase
          .from("earnings")
          .select("amount_xcd, created_at")
          .gte(
            "created_at",
            new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
          ),
      ]);
      const monthly = (earnings.data ?? []).reduce(
        (sum, e) => sum + Number(e.amount_xcd ?? 0),
        0,
      );
      return {
        availableRooms: rooms.count ?? 0,
        activeRedirects: redirects.count ?? 0,
        monthlyEarnings: monthly,
        propertyCount: properties.count ?? 0,
      };
    },
  });

  const queue = useQuery({
    queryKey: ["admin", "redirect-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("redirects")
        .select(
          `id, status, created_at, admin_notes,
           traveller:travellers(full_name, nights_needed, source, budget_max_xcd, guest_count),
           matched:properties!redirects_matched_property_id_fkey(name, type, parish),
           from:properties!redirects_from_property_id_fkey(name)`,
        )
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    },
  });

  const earningsByType = useQuery({
    queryKey: ["admin", "earnings-by-type"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("finders_fee_xcd, property:properties(type)")
        .gte(
          "created_at",
          new Date(new Date().getFullYear(), 0, 1).toISOString(),
        );
      if (error) throw error;
      const buckets: Record<string, number> = {};
      (data ?? []).forEach((b: { finders_fee_xcd: number | null; property: { type: string } | null }) => {
        const t = b.property?.type ?? "other";
        buckets[t] = (buckets[t] ?? 0) + Number(b.finders_fee_xcd ?? 0);
      });
      return Object.entries(buckets).map(([type, total]) => ({ type, total }));
    },
  });

  const topPartners = useQuery({
    queryKey: ["admin", "top-partners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select("id, business_name, fee_rate, fee_agreement_type, status")
        .order("joined_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const newCount = (queue.data ?? []).filter((r) => r.status === "new").length;

  return (
    <div className="px-6 lg:px-10 py-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Overview</p>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">Good day — here's the queue.</h1>
        </div>
        <Link
          to="/admin/redirects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-glow"
        >
          Manage redirects <ArrowUpRight className="h-4 w-4" />
        </Link>
      </header>

      {/* Alert banner */}
      {newCount > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber/40 bg-amber/10 px-5 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-amber text-amber-foreground">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="font-medium">
              {newCount} new redirect request{newCount === 1 ? "" : "s"} awaiting match
            </div>
            <div className="text-sm text-muted-foreground">
              Review the queue below and assign a property.
            </div>
          </div>
          <Link
            to="/admin/redirects"
            className="self-center rounded-lg bg-amber px-3.5 py-2 text-sm font-medium text-amber-foreground hover:bg-amber/90"
          >
            Open queue
          </Link>
        </div>
      )}

      {/* Metric cards */}
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Rooms available tonight"
          value={metrics.data?.availableRooms ?? "—"}
          icon={BedDouble}
          tone="mint"
        />
        <MetricCard
          label="Active redirects"
          value={metrics.data?.activeRedirects ?? "—"}
          icon={ArrowRightLeft}
          tone="amber"
        />
        <MetricCard
          label="Earnings this month"
          value={formatXCD(metrics.data?.monthlyEarnings ?? 0)}
          icon={Coins}
          hint="Finder's fees, all partners"
        />
        <MetricCard
          label="Partner properties"
          value={metrics.data?.propertyCount ?? "—"}
          icon={Building2}
        />
      </section>

      {/* Queue + chart */}
      <section className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <div>
              <h2 className="font-display text-xl">Recent redirect queue</h2>
              <p className="text-xs text-muted-foreground">Latest 8 requests</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
                <tr>
                  <th className="px-5 py-3 font-medium">Traveller</th>
                  <th className="px-5 py-3 font-medium">Nights</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Matched to</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {queue.isLoading && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!queue.isLoading && (queue.data?.length ?? 0) === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No redirect requests yet.</td></tr>
                )}
                {queue.data?.map((r) => {
                  const t = r.traveller as { full_name?: string; nights_needed?: number; source?: string } | null;
                  const m = r.matched as { name?: string; type?: string; parish?: string } | null;
                  return (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3.5">
                        <div className="font-medium">{t?.full_name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(r.created_at)}</div>
                      </td>
                      <td className="px-5 py-3.5">{t?.nights_needed ?? "—"}</td>
                      <td className="px-5 py-3.5 capitalize text-muted-foreground">{t?.source ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        {m ? (
                          <div>
                            <div className="font-medium">{m.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">{m.type} · {m.parish}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-display text-xl">Earnings by type</h2>
          <p className="text-xs text-muted-foreground">YTD finder's fees, EC$</p>
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={earningsByType.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="type" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => formatXCD(v)}
                />
                <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Top partners */}
      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="font-display text-xl">Top partners</h2>
          <p className="text-xs text-muted-foreground">Most recent active partners</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium">Business</th>
                <th className="px-5 py-3 font-medium">Fee agreement</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {topPartners.isLoading && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!topPartners.isLoading && (topPartners.data?.length ?? 0) === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">No partners onboarded yet.</td></tr>
              )}
              {topPartners.data?.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3.5 font-medium">{p.business_name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {p.fee_agreement_type === "flat"
                      ? `Flat ${formatXCD(p.fee_rate)}`
                      : `${p.fee_rate}% per booking`}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        className={
                          p.status === "active"
                            ? "h-2 w-2 rounded-full bg-mint"
                            : p.status === "onboarding"
                              ? "h-2 w-2 rounded-full bg-amber"
                              : "h-2 w-2 rounded-full bg-muted-foreground"
                        }
                      />
                      <span className="capitalize">{p.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    new: "bg-amber/20 text-amber-foreground border-amber/40",
    pending: "bg-muted text-muted-foreground border-border",
    matched: "bg-mint/30 text-primary border-mint/50",
    confirmed: "bg-primary text-primary-foreground border-primary",
    cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <Badge variant="outline" className={`capitalize ${tone[status] ?? ""}`}>
      {status}
    </Badge>
  );
}
