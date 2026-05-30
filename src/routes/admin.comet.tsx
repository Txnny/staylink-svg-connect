import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/comet")({
  component: CometPage,
});

function CometPage() {
  const pageRef = useRef<HTMLDivElement>(null);

  const snapshot = useQuery({
    queryKey: ["comet-snapshot"],
    queryFn: fetchSnapshot,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });

  // Silent auto-refresh — no loading flash
  const data = snapshot.data;

  function copyAll() {
    const text = pageRef.current?.innerText ?? "";
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Copy failed")
    );
  }

  const lastUpdated = useRef<string>("");
  useEffect(() => {
    if (snapshot.dataUpdatedAt) {
      lastUpdated.current = new Date(snapshot.dataUpdatedAt).toLocaleTimeString("en-GB");
    }
  }, [snapshot.dataUpdatedAt]);

  return (
    <div className="min-h-screen bg-zinc-950 text-green-400 font-mono text-sm px-6 py-8">
      <div className="max-w-4xl mx-auto space-y-10" ref={pageRef}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-green-300 text-xs uppercase tracking-[0.3em] mb-1">
              STAYLINK SVG — COMET CONTEXT FEED
            </div>
            <div className="text-green-600 text-xs">
              Auto-refresh every 60s · Last update: {lastUpdated.current || "—"}
            </div>
          </div>
          <button
            onClick={copyAll}
            className="shrink-0 border border-green-700 text-green-400 hover:bg-green-900/30 text-xs px-3 py-1.5 rounded transition-colors"
          >
            Copy All
          </button>
        </div>

        {snapshot.isLoading && (
          <div className="text-green-600">Loading platform data…</div>
        )}

        {data && (
          <>
            {/* 1. Platform Snapshot */}
            <Section title="1. PLATFORM SNAPSHOT">
              <KV label="Total properties" value={data.totalProperties} />
              <KV label="Available rooms tonight" value={data.availableRooms} />
              <KV label="Open redirects (new/pending)" value={data.openRedirects} />
              <KV label="Pending fees (EC$)" value={`EC$ ${data.pendingFeesXcd.toLocaleString("en-US")}`} />
            </Section>

            {/* 2. Redirect Queue */}
            <Section title="2. REDIRECT QUEUE (new / pending)">
              {data.redirectQueue.length === 0 && <div className="text-green-700">No open redirects.</div>}
              {data.redirectQueue.map((r, i) => (
                <div key={r.id} className="border-t border-green-900 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
                  <div className="text-green-200 font-bold">#{i + 1} {r.full_name}</div>
                  <KV label="Arrival" value={r.arrival_date ?? "—"} />
                  <KV label="Nights needed" value={r.nights_needed ?? "—"} />
                  <KV label="Budget min" value={r.budget_min_xcd != null ? `EC$ ${r.budget_min_xcd}` : "—"} />
                  <KV label="Type preference" value={r.type_preference ?? "—"} />
                  {r.notes && <KV label="Notes" value={r.notes} />}
                </div>
              ))}
            </Section>

            {/* 3. Available Rooms Right Now */}
            <Section title="3. AVAILABLE ROOMS RIGHT NOW">
              {data.availableRoomList.length === 0 && <div className="text-green-700">No available rooms.</div>}
              {data.availableRoomList.map((r, i) => (
                <div key={r.room_id} className="border-t border-green-900 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
                  <div className="text-green-200 font-bold">#{i + 1} {r.property_name} — {r.room_name}</div>
                  <KV label="Property type" value={r.property_type} />
                  <KV label="Parish" value={r.parish ?? "—"} />
                  <KV label="Room type" value={r.room_type ?? "—"} />
                  <KV label="Max guests" value={r.max_guests} />
                  <KV label="Price / night" value={`EC$ ${r.price_per_night_xcd}`} />
                  <KV label="Partner email" value={r.partner_email ?? "—"} />
                </div>
              ))}
            </Section>

            {/* 4. Partner Contact List */}
            <Section title="4. PARTNER CONTACT LIST (active)">
              {data.partnerList.length === 0 && <div className="text-green-700">No active partners.</div>}
              {data.partnerList.map((p, i) => (
                <div key={p.id} className="border-t border-green-900 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
                  <div className="text-green-200 font-bold">#{i + 1} {p.business_name}</div>
                  <KV label="Parish" value={p.parish ?? "—"} />
                  <KV label="Contact" value={p.contact_name} />
                  <KV label="Email" value={p.email} />
                  <KV label="Phone" value={p.phone ?? "—"} />
                  <KV label="Fee" value={p.fee_agreement_type === "flat" ? `Flat EC$${p.fee_rate}/booking` : `${p.fee_rate}% per booking`} />
                </div>
              ))}
            </Section>

            {/* 5. Pending Fees */}
            <Section title="5. PENDING FEES">
              {data.pendingFeeList.length === 0 && <div className="text-green-700">No pending fees.</div>}
              {data.pendingFeeList.map((f, i) => (
                <div key={f.id} className="border-t border-green-900 pt-3 mt-3 first:border-0 first:pt-0 first:mt-0">
                  <div className="text-green-200 font-bold">#{i + 1} {f.partner_name}</div>
                  <KV label="Booking date" value={f.booking_date ?? "—"} />
                  <KV label="Traveller" value={f.traveller_name ?? "—"} />
                  <KV label="Amount (EC$)" value={`EC$ ${f.amount_xcd}`} />
                  <KV label="Days since" value={f.days_since} />
                </div>
              ))}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-green-500 text-xs uppercase tracking-[0.2em] mb-3 border-b border-green-900 pb-1">
        {title}
      </div>
      <div className="space-y-0.5 pl-2">{children}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex gap-2 text-xs leading-5">
      <span className="text-green-600 min-w-[160px] shrink-0">{label}:</span>
      <span className="text-green-300">{String(value ?? "—")}</span>
    </div>
  );
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function fetchSnapshot() {
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: props },
    { data: roomsData },
    { data: redirectsData },
    { data: earningsData },
    { data: partnersData },
  ] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact" }),
    supabase
      .from("rooms")
      .select(
        "id, name, room_type, max_guests, price_per_night_xcd, available, available_from, available_to, property:properties(id, name, type, parish, partner:partners(email))"
      )
      .eq("available", true),
    supabase
      .from("redirects")
      .select(
        "id, status, traveller:travellers(full_name, arrival_date, nights_needed, budget_min_xcd, accommodation_type_preference, notes)"
      )
      .in("status", ["new", "pending"]),
    supabase
      .from("earnings")
      .select("id, amount_xcd, status, created_at, partner:partners(business_name), booking:bookings(check_in, traveller:travellers(full_name))")
      .eq("status", "pending"),
    supabase
      .from("partners")
      .select("id, business_name, contact_name, email, phone, parish, fee_agreement_type, fee_rate")
      .eq("status", "active"),
  ]);

  const availableRoomList = (roomsData ?? [])
    .filter((r) => {
      const prop = Array.isArray(r.property) ? r.property[0] : r.property;
      if (!prop) return false;
      if (r.available_from && r.available_from > today) return false;
      if (r.available_to && r.available_to < today) return false;
      return true;
    })
    .map((r) => {
      const prop = Array.isArray(r.property) ? r.property[0] : r.property;
      const partner = prop
        ? Array.isArray((prop as { partner?: unknown }).partner)
          ? ((prop as { partner: { email: string }[] }).partner)[0]
          : (prop as { partner?: { email: string } | null }).partner
        : null;
      return {
        room_id: r.id,
        room_name: r.name,
        room_type: r.room_type,
        max_guests: r.max_guests,
        price_per_night_xcd: r.price_per_night_xcd,
        property_name: (prop as { name: string } | null)?.name ?? "—",
        property_type: (prop as { type: string } | null)?.type ?? "—",
        parish: (prop as { parish?: string | null } | null)?.parish ?? null,
        partner_email: (partner as { email?: string } | null)?.email ?? null,
      };
    });

  const redirectQueue = (redirectsData ?? []).map((r) => {
    const t = Array.isArray(r.traveller) ? r.traveller[0] : r.traveller;
    return {
      id: r.id,
      full_name: (t as { full_name?: string } | null)?.full_name ?? "—",
      arrival_date: (t as { arrival_date?: string | null } | null)?.arrival_date ?? null,
      nights_needed: (t as { nights_needed?: number | null } | null)?.nights_needed ?? null,
      budget_min_xcd: (t as { budget_min_xcd?: number | null } | null)?.budget_min_xcd ?? null,
      type_preference: (t as { accommodation_type_preference?: string | null } | null)?.accommodation_type_preference ?? null,
      notes: (t as { notes?: string | null } | null)?.notes ?? null,
    };
  });

  const pendingFeeList = (earningsData ?? []).map((e) => {
    const p = Array.isArray(e.partner) ? e.partner[0] : e.partner;
    const b = Array.isArray(e.booking) ? e.booking[0] : e.booking;
    const t = b
      ? Array.isArray((b as { traveller?: unknown }).traveller)
        ? ((b as { traveller: { full_name: string }[] }).traveller)[0]
        : (b as { traveller?: { full_name: string } | null }).traveller
      : null;
    const created = new Date(e.created_at);
    const daysSince = Math.floor((Date.now() - created.getTime()) / 86_400_000);
    return {
      id: e.id,
      partner_name: (p as { business_name?: string } | null)?.business_name ?? "—",
      booking_date: (b as { check_in?: string | null } | null)?.check_in ?? null,
      traveller_name: (t as { full_name?: string } | null)?.full_name ?? "—",
      amount_xcd: Number(e.amount_xcd).toLocaleString("en-US"),
      days_since: daysSince,
    };
  });

  const pendingFeesXcd = (earningsData ?? []).reduce((s, e) => s + Number(e.amount_xcd), 0);

  return {
    totalProperties: props?.length ?? 0,
    availableRooms: availableRoomList.length,
    openRedirects: redirectQueue.length,
    pendingFeesXcd,
    redirectQueue,
    availableRoomList,
    partnerList: (partnersData ?? []) as {
      id: string;
      business_name: string;
      contact_name: string;
      email: string;
      phone: string | null;
      parish: string | null;
      fee_agreement_type: string;
      fee_rate: number;
    }[],
    pendingFeeList,
  };
}
