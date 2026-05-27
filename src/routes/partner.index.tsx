import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { formatXCD, formatDate } from "@/lib/format";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Building2, BedDouble, Coins, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/partner/")({
  component: PartnerDashboard,
});

function PartnerDashboard() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  const partner = useQuery({
    queryKey: ["partner", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, business_name, status, fee_rate, fee_agreement_type")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const properties = useQuery({
    queryKey: ["partner-properties", partner.data?.id],
    enabled: !!partner.data?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("id, name, type, parish, status, rooms(id, available)")
        .eq("partner_id", partner.data!.id);
      return data ?? [];
    },
  });

  const rooms = useQuery({
    queryKey: ["partner-rooms", partner.data?.id],
    enabled: !!partner.data?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id, name, room_type, price_per_night_xcd, max_guests, available, property:properties!inner(id, name, partner_id)")
        .eq("property.partner_id", partner.data!.id);
      return data ?? [];
    },
  });

  const redirects = useQuery({
    queryKey: ["partner-redirects", partner.data?.id],
    enabled: !!partner.data?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("redirects")
        .select(`id, status, created_at, matched:properties!redirects_matched_property_id_fkey!inner(name, partner_id),
                 traveller:travellers(full_name, nights_needed)`)
        .eq("matched.partner_id", partner.data!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const earnings = useQuery({
    queryKey: ["partner-earnings", partner.data?.id],
    enabled: !!partner.data?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("earnings")
        .select("amount_xcd, status, created_at, booking_id")
        .eq("partner_id", partner.data!.id);
      const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const month = (data ?? [])
        .filter((e) => e.status === "paid" && e.created_at >= startMonth)
        .reduce((s, e) => s + Number(e.amount_xcd), 0);
      const all = (data ?? [])
        .filter((e) => e.status === "paid")
        .reduce((s, e) => s + Number(e.amount_xcd), 0);
      return { month, all };
    },
  });

  if (partner.isLoading) {
    return <div className="max-w-6xl mx-auto px-5 lg:px-8 py-10 text-muted-foreground">Loading your portal…</div>;
  }

  if (!partner.data) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <h1 className="font-display text-3xl">Almost there.</h1>
        <p className="mt-3 text-muted-foreground">
          Your account is signed in but isn't linked to a partner profile yet. Our team will
          finish your onboarding shortly. If this is unexpected, please contact StayLink support.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 lg:px-8 py-10 space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Welcome back</p>
        <h1 className="font-display text-3xl lg:text-4xl mt-1">{partner.data.business_name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Status: <span className="capitalize text-foreground">{partner.data.status}</span> · Fee:{" "}
          {partner.data.fee_agreement_type === "flat"
            ? `Flat ${formatXCD(partner.data.fee_rate)}/booking`
            : `${partner.data.fee_rate}% per booking`}
        </p>
      </header>

      {/* Metric cards */}
      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Building2} label="Properties" value={properties.data?.length ?? 0} />
        <Metric
          icon={BedDouble}
          label="Rooms available"
          value={(rooms.data ?? []).filter((r) => r.available).length}
          hint={`of ${rooms.data?.length ?? 0} total`}
        />
        <Metric
          icon={Coins}
          label="Earnings this month"
          value={formatXCD(earnings.data?.month ?? 0)}
          hint="Confirmed only"
        />
        <Metric icon={Coins} label="All-time earnings" value={formatXCD(earnings.data?.all ?? 0)} />
      </section>

      {/* Properties */}
      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="font-display text-xl">Your properties</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Parish</th>
                <th className="px-5 py-3 font-medium">Rooms</th>
                <th className="px-5 py-3 font-medium">Available</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(properties.data ?? []).length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No properties added yet.</td></tr>
              )}
              {properties.data?.map((p) => {
                const roomList = (p.rooms ?? []) as { id: string; available: boolean }[];
                return (
                  <tr key={p.id}>
                    <td className="px-5 py-3.5 font-medium">{p.name}</td>
                    <td className="px-5 py-3.5 capitalize text-muted-foreground">{p.type}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{p.parish ?? "—"}</td>
                    <td className="px-5 py-3.5">{roomList.length}</td>
                    <td className="px-5 py-3.5">{roomList.filter((r) => r.available).length}</td>
                    <td className="px-5 py-3.5"><Badge variant="outline" className="capitalize">{p.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Rooms manager */}
      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="font-display text-xl">Rooms manager</h2>
          <p className="text-xs text-muted-foreground">Toggle availability — changes go live instantly.</p>
        </div>
        <RoomsTable rooms={rooms.data ?? []} />
      </section>

      {/* Redirect history */}
      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-xl">Redirect history</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium">Traveller</th>
                <th className="px-5 py-3 font-medium">Nights</th>
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(redirects.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No redirects yet.</td></tr>
              )}
              {redirects.data?.map((r) => {
                const t = r.traveller as { full_name?: string; nights_needed?: number } | null;
                const m = r.matched as { name?: string } | null;
                return (
                  <tr key={r.id}>
                    <td className="px-5 py-3.5 font-medium">{t?.full_name ?? "—"}</td>
                    <td className="px-5 py-3.5">{t?.nights_needed ?? "—"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{m?.name ?? "—"}</td>
                    <td className="px-5 py-3.5"><Badge variant="outline" className="capitalize">{r.status}</Badge></td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">{formatDate(r.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-3 font-display text-2xl">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

type RoomItem = {
  id: string;
  name: string;
  room_type: string | null;
  price_per_night_xcd: number;
  max_guests: number;
  available: boolean;
  property: { name: string } | { name: string }[] | null;
};

function RoomsTable({ rooms }: { rooms: RoomItem[] }) {
  const qc = useQueryClient();
  async function toggle(id: string, next: boolean) {
    const { error } = await supabase.from("rooms").update({ available: next }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(next ? "Room marked available" : "Room marked unavailable");
    qc.invalidateQueries({ queryKey: ["partner-rooms"] });
    qc.invalidateQueries({ queryKey: ["partner-properties"] });
  }

  if (rooms.length === 0) {
    return <div className="px-5 py-8 text-center text-muted-foreground text-sm">No rooms added yet.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
          <tr>
            <th className="px-5 py-3 font-medium">Room</th>
            <th className="px-5 py-3 font-medium">Property</th>
            <th className="px-5 py-3 font-medium">Capacity</th>
            <th className="px-5 py-3 font-medium">Rate</th>
            <th className="px-5 py-3 font-medium">Available</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rooms.map((r) => {
            const propName = Array.isArray(r.property) ? r.property[0]?.name : r.property?.name;
            return (
              <tr key={r.id}>
                <td className="px-5 py-3.5">
                  <div className="font-medium">{r.name}</div>
                  {r.room_type && <div className="text-xs text-muted-foreground capitalize">{r.room_type}</div>}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">{propName ?? "—"}</td>
                <td className="px-5 py-3.5">{r.max_guests}</td>
                <td className="px-5 py-3.5">{formatXCD(r.price_per_night_xcd)}</td>
                <td className="px-5 py-3.5">
                  <Switch checked={r.available} onCheckedChange={(v) => toggle(r.id, v)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
