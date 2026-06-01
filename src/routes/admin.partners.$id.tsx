import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatXCD } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Phone, MapPin, Building2, BedDouble, Coins } from "lucide-react";

export const Route = createFileRoute("/admin/partners/$id")({
  component: PartnerProfilePage,
});

type Partner = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  parish: string | null;
  room_count: number | null;
  fee_agreement_type: "flat" | "percentage";
  fee_rate: number;
  status: "onboarding" | "active" | "inactive";
  bank_details: string | null;
  joined_at: string;
  user_id: string | null;
};

function PartnerProfilePage() {
  const { id } = Route.useParams();

  const partner = useQuery({
    queryKey: ["admin", "partner", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partners")
        .select(
          "id, business_name, contact_name, email, phone, parish, room_count, fee_agreement_type, fee_rate, status, bank_details, joined_at, user_id"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Partner | null;
    },
  });

  const properties = useQuery({
    queryKey: ["admin", "partner-properties", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("id, name, type, parish, status, rooms(id, available)")
        .eq("partner_id", id);
      return data ?? [];
    },
  });

  const earnings = useQuery({
    queryKey: ["admin", "partner-earnings", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("earnings")
        .select("id, amount_xcd, status, invoice_number, invoice_date, paid_date, created_at")
        .eq("partner_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (partner.isLoading) {
    return <div className="px-6 lg:px-10 py-10 text-muted-foreground">Loading partner…</div>;
  }
  if (!partner.data) {
    return (
      <div className="px-6 lg:px-10 py-10">
        <p className="text-muted-foreground">Partner not found.</p>
        <Link to="/admin/partners" className="text-primary text-sm mt-3 inline-block">
          ← Back to partners
        </Link>
      </div>
    );
  }

  const p = partner.data;
  const totalRooms = (properties.data ?? []).flatMap((pr) => pr.rooms ?? []).length;
  const availRooms = (properties.data ?? [])
    .flatMap((pr) => pr.rooms ?? [])
    .filter((r: { available: boolean }) => r.available).length;
  const paid = (earnings.data ?? [])
    .filter((e) => e.status === "paid")
    .reduce((s, e) => s + Number(e.amount_xcd), 0);
  const pending = (earnings.data ?? [])
    .filter((e) => e.status !== "paid")
    .reduce((s, e) => s + Number(e.amount_xcd), 0);

  return (
    <div className="px-6 lg:px-10 py-8 max-w-6xl mx-auto space-y-8">
      <div>
        <Link
          to="/admin/partners"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to partners
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Partner profile</p>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">{p.business_name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {p.contact_name} · Joined {formatDate(p.joined_at)}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">{p.status}</Badge>
      </header>

      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Building2} label="Properties" value={properties.data?.length ?? 0} />
        <Stat icon={BedDouble} label="Rooms available" value={availRooms} hint={`of ${totalRooms} total`} />
        <Stat icon={Coins} label="Paid out" value={formatXCD(paid)} />
        <Stat icon={Coins} label="Pending earnings" value={formatXCD(pending)} />
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="font-display text-xl">Contact & agreement</h2>
        </div>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 px-5 py-5 text-sm">
          <Field icon={Mail} label="Email" value={p.email} />
          <Field icon={Phone} label="Phone" value={p.phone ?? "—"} />
          <Field icon={MapPin} label="Parish" value={p.parish ?? "—"} />
          <Field label="Fee agreement" value={
            p.fee_agreement_type === "flat"
              ? `Flat ${formatXCD(p.fee_rate)} per booking`
              : `${p.fee_rate}% per booking`
          } />
          <Field label="Stated room count" value={p.room_count?.toString() ?? "—"} />
          <Field label="Auth user" value={p.user_id ?? "Not linked"} />
          <div className="md:col-span-2">
            <Field label="Bank details" value={p.bank_details ?? "—"} multiline />
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="font-display text-xl">Properties</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Parish</th>
                <th className="px-5 py-3 font-medium">Rooms</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(properties.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No properties yet.</td></tr>
              )}
              {properties.data?.map((pr) => (
                <tr key={pr.id}>
                  <td className="px-5 py-3.5 font-medium">{pr.name}</td>
                  <td className="px-5 py-3.5 capitalize text-muted-foreground">{pr.type}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{pr.parish ?? "—"}</td>
                  <td className="px-5 py-3.5">{(pr.rooms ?? []).length}</td>
                  <td className="px-5 py-3.5"><Badge variant="outline" className="capitalize">{pr.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="font-display text-xl">Earnings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Invoiced</th>
                <th className="px-5 py-3 font-medium">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(earnings.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No earnings yet.</td></tr>
              )}
              {earnings.data?.map((e) => (
                <tr key={e.id}>
                  <td className="px-5 py-3.5 font-medium">{e.invoice_number ?? "—"}</td>
                  <td className="px-5 py-3.5">{formatXCD(e.amount_xcd)}</td>
                  <td className="px-5 py-3.5"><Badge variant="outline" className="capitalize">{e.status}</Badge></td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{e.invoice_date ? formatDate(e.invoice_date) : "—"}</td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{e.paid_date ? formatDate(e.paid_date) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
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
    <div className="rounded-2xl border bg-card px-5 py-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="font-display text-2xl mt-1.5">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  multiline,
}: {
  icon?: typeof Mail;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </dt>
      <dd className={`mt-1 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</dd>
    </div>
  );
}

// silence unused Button import warning for future actions
void Button;
