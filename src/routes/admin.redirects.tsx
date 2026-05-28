import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatXCD, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sparkles, Loader2, Check, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { sendEmail, templates } from "@/lib/emails";

export const Route = createFileRoute("/admin/redirects")({
  component: RedirectsPage,
});

type Status = "all" | "new" | "pending" | "matched" | "confirmed" | "cancelled";

type RedirectRow = {
  id: string;
  status: string;
  created_at: string;
  admin_notes: string | null;
  traveller: {
    id?: string;
    full_name?: string;
    nights_needed?: number;
    guest_count?: number;
    budget_max_xcd?: number | null;
    arrival_date?: string | null;
    departure_date?: string | null;
    accommodation_type_preference?: string | null;
  } | null;
  matched: { id?: string; name?: string; type?: string } | null;
  from: { name?: string } | null;
};

function RedirectsPage() {
  const [status, setStatus] = useState<Status>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [matching, setMatching] = useState<RedirectRow | null>(null);

  const list = useQuery({
    queryKey: ["admin", "redirects", status, fromDate, toDate],
    queryFn: async () => {
      let q = supabase
        .from("redirects")
        .select(
          `id, status, created_at, admin_notes,
           traveller:travellers(id, full_name, nights_needed, guest_count, budget_max_xcd, arrival_date, departure_date, accommodation_type_preference),
           matched:properties!redirects_matched_property_id_fkey(id, name, type),
           from:properties!redirects_from_property_id_fkey(name)`,
        )
        .order("created_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status as Exclude<Status, "all">);
      if (fromDate) q = q.gte("created_at", fromDate);
      if (toDate) q = q.lte("created_at", toDate + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RedirectRow[];
    },
  });

  return (
    <div className="px-6 lg:px-10 py-8 max-w-7xl mx-auto space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Operations</p>
        <h1 className="font-display text-3xl lg:text-4xl mt-1">Redirect queue</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Match displaced travellers with the right room. Filter by status or date.
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end rounded-xl border bg-card p-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="pending">Pending</option>
            <option value="matched">Matched</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </div>
        {(status !== "all" || fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStatus("all"); setFromDate(""); setToDate(""); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium">Traveller</th>
                <th className="px-5 py-3 font-medium">Displaced from</th>
                <th className="px-5 py-3 font-medium">Matched to</th>
                <th className="px-5 py-3 font-medium">Nights</th>
                <th className="px-5 py-3 font-medium">Fee est.</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.isLoading && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!list.isLoading && (list.data?.length ?? 0) === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No redirects match these filters.</td></tr>
              )}
              {list.data?.map((r) => {
                const t = r.traveller;
                const nights = t?.nights_needed ?? 0;
                const budget = Number(t?.budget_max_xcd ?? 0);
                const feeEst = budget && nights ? budget * nights * 0.10 : 0;
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3.5">
                      <div className="font-medium">{t?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {t?.guest_count ?? 1} guest{(t?.guest_count ?? 1) === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{r.from?.name ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      {r.matched ? (
                        <div>
                          <div className="font-medium">{r.matched.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">{r.matched.type}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{nights || "—"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{feeEst ? formatXCD(feeEst) : "—"}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">{formatDate(r.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {(r.status === "new" || r.status === "pending") && (
                        <Button size="sm" onClick={() => setMatching(r)}>
                          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Match
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {matching && (
        <MatchDialog
          redirect={matching}
          onClose={() => setMatching(null)}
        />
      )}
    </div>
  );
}

type MatchResult = {
  room_id: string;
  property_id: string;
  property_name: string;
  property_type: string;
  location: string | null;
  room_name: string;
  price_per_night_xcd: number;
  max_guests: number;
  property_contact_email: string | null;
  booking_url: string;
  score: number;
};

function MatchDialog({ redirect, onClose }: { redirect: RedirectRow; onClose: () => void }) {
  const qc = useQueryClient();
  const t = redirect.traveller;
  const [selected, setSelected] = useState<MatchResult | null>(null);
  const [confirming, setConfirming] = useState(false);

  const params = useMemo(() => ({
    check_in: t?.arrival_date ?? new Date().toISOString().slice(0, 10),
    check_out:
      t?.departure_date ??
      new Date(Date.now() + (t?.nights_needed ?? 1) * 86400000).toISOString().slice(0, 10),
    guest_count: t?.guest_count ?? 1,
    budget_max_xcd: Number(t?.budget_max_xcd ?? 9999),
    type_preference: t?.accommodation_type_preference ?? null,
  }), [t]);

  const matches = useQuery({
    queryKey: ["match-rooms", redirect.id, params],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("match-rooms", {
        body: params,
      });
      if (error) throw error;
      return data as { primary_matches: MatchResult[]; partial_matches: MatchResult[] };
    },
  });

  async function confirmMatch() {
    if (!selected) return;
    setConfirming(true);
    const { error } = await supabase
      .from("redirects")
      .update({
        status: "matched",
        matched_property_id: selected.property_id,
        matched_room_id: selected.room_id,
      })
      .eq("id", redirect.id);
    setConfirming(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Matched to ${selected.property_name}`);
    qc.invalidateQueries({ queryKey: ["admin", "redirects"] });
    qc.invalidateQueries({ queryKey: ["admin", "redirect-queue"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Match {t?.full_name}</DialogTitle>
          <DialogDescription>
            {params.check_in} → {params.check_out} · {params.guest_count} guest{params.guest_count === 1 ? "" : "s"} ·
            budget {formatXCD(params.budget_max_xcd)}/night
            {params.type_preference ? ` · prefers ${params.type_preference}` : ""}
          </DialogDescription>
        </DialogHeader>

        {matches.isLoading && (
          <div className="py-12 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Finding matches…
          </div>
        )}
        {matches.error && (
          <div className="py-6 text-sm text-destructive">
            Could not load matches: {(matches.error as Error).message}
          </div>
        )}
        {matches.data && (
          <div className="space-y-6">
            <MatchGroup
              title="Primary matches"
              subtitle="Best fit by type, price and capacity"
              items={matches.data.primary_matches}
              selected={selected}
              onSelect={setSelected}
            />
            <MatchGroup
              title="Partial matches"
              subtitle="Available rooms outside the type preference"
              items={matches.data.partial_matches}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={confirmMatch} disabled={!selected || confirming}>
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
            Confirm match
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MatchGroup({
  title,
  subtitle,
  items,
  selected,
  onSelect,
}: {
  title: string;
  subtitle: string;
  items: MatchResult[];
  selected: MatchResult | null;
  onSelect: (m: MatchResult) => void;
}) {
  return (
    <div>
      <div className="mb-2">
        <h3 className="font-display text-lg">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">No options found.</p>
      ) : (
        <div className="grid gap-3">
          {items.map((m) => {
            const isSelected = selected?.room_id === m.room_id;
            return (
              <button
                key={m.room_id}
                type="button"
                onClick={() => onSelect(m)}
                className={`text-left rounded-xl border p-4 transition ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                    : "border-border hover:border-primary/40 bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{m.property_name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {m.property_type} · {m.location ?? "—"}
                    </div>
                    <div className="mt-1 text-sm">{m.room_name} · up to {m.max_guests} guests</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg">{formatXCD(m.price_per_night_xcd)}</div>
                    <div className="text-[11px] text-muted-foreground">per night</div>
                    {m.score > 0 && (
                      <Badge variant="outline" className="mt-1.5 bg-mint/20 border-mint/40 text-primary">
                        score {m.score}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    new: "bg-blue-500/15 text-blue-700 border-blue-500/40",
    pending: "bg-amber/20 text-amber-foreground border-amber/40",
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
