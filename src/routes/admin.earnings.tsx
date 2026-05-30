import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { formatXCD, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/earnings")({
  component: EarningsPage,
});

type EarningRow = {
  id: string;
  amount_xcd: number;
  status: string;
  invoice_number: string | null;
  invoice_date: string | null;
  created_at: string;
  booking: {
    id: string;
    check_in: string | null;
    check_out: string | null;
    nights: number | null;
    total_xcd: number | null;
    fee_rate: number | null;
    fee_type: string | null;
    confirmed_at?: string | null;
    traveller: { full_name: string } | null;
    property: { name: string } | null;
    room: { name: string } | null;
  } | null;
  partner: {
    id: string;
    business_name: string;
    contact_name: string;
    email: string;
    fee_agreement_type: string;
    fee_rate: number;
  } | null;
};

type GroupKey = string; // "YYYY-MM::partner_id"

function EarningsPage() {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState<GroupKey | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null); // earnings row id

  const earnings = useQuery({
    queryKey: ["admin-earnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("earnings")
        .select(
          `id, amount_xcd, status, invoice_number, invoice_date, created_at,
           booking:bookings(id, check_in, check_out, nights, total_xcd, fee_rate, fee_type,
             traveller:travellers(full_name),
             property:properties(name),
             room:rooms(name)
           ),
           partner:partners(id, business_name, contact_name, email, fee_agreement_type, fee_rate)`
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EarningRow[];
    },
  });

  // Group by partner × month
  const groups = groupEarnings(earnings.data ?? []);

  async function generateInvoice(key: GroupKey) {
    const rows = groups[key];
    if (!rows?.length) return;
    const partner = rows[0].partner!;
    const [yearMonth] = key.split("::");
    const [year, month] = yearMonth.split("-");

    setGenerating(key);
    try {
      const invoiceNum = `INV-${year}-${month}-${partner.id.slice(0, 6).toUpperCase()}`;
      const invoiceDate = new Date();
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const pdf = buildPDF({ rows, partner, invoiceNum, invoiceDate, dueDate, year, month });

      const partnerSlug = partner.business_name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
      pdf.save(`INV-${year}-${month}-${partnerSlug}.pdf`);

      // Update earnings rows to invoiced
      const ids = rows.map((r) => r.id);
      const { error } = await supabase
        .from("earnings")
        .update({
          status: "invoiced",
          invoice_number: invoiceNum,
          invoice_date: invoiceDate.toISOString().split("T")[0],
        })
        .in("id", ids);

      if (error) {
        toast.error("PDF downloaded but failed to update status: " + error.message);
      } else {
        toast.success(`Invoice ${invoiceNum} generated`);
        qc.invalidateQueries({ queryKey: ["admin-earnings"] });
      }
    } finally {
      setGenerating(null);
    }
  }

  async function markGroupPaid(key: GroupKey) {
    const rows = groups[key];
    if (!rows?.length) return;
    const ids = rows.filter((r) => r.status !== "paid").map((r) => r.id);
    if (!ids.length) { toast("All rows already marked paid"); return; }

    const today = new Date().toISOString().split("T")[0];
    const { error: eErr } = await supabase
      .from("earnings")
      .update({ status: "paid", paid_date: today })
      .in("id", ids);
    if (eErr) { toast.error(eErr.message); return; }

    // Also mark associated bookings fee_status = paid
    const bookingIds = rows
      .filter((r) => r.booking?.id && ids.includes(r.id))
      .map((r) => r.booking!.id);
    if (bookingIds.length) {
      await supabase.from("bookings").update({ fee_status: "paid" }).in("id", bookingIds);
    }

    toast.success(`${ids.length} earning${ids.length === 1 ? "" : "s"} marked as paid`);
    qc.invalidateQueries({ queryKey: ["admin-earnings"] });
  }

  async function markRowPaid(row: EarningRow) {
    if (row.status === "paid") return;
    setMarkingPaid(row.id);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { error } = await supabase
        .from("earnings")
        .update({ status: "paid", paid_date: today })
        .eq("id", row.id);
      if (error) { toast.error(error.message); return; }

      if (row.booking?.id) {
        await supabase.from("bookings").update({ fee_status: "paid" }).eq("id", row.booking.id);
      }
      toast.success("Marked as paid");
      qc.invalidateQueries({ queryKey: ["admin-earnings"] });
    } finally {
      setMarkingPaid(null);
    }
  }

  if (earnings.isLoading) {
    return (
      <div className="px-6 lg:px-10 py-10 max-w-7xl mx-auto text-muted-foreground">Loading…</div>
    );
  }

  const groupKeys = Object.keys(groups).sort().reverse();

  return (
    <div className="px-6 lg:px-10 py-10 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-3xl">Earnings &amp; invoicing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monthly statements grouped by partner. Generate PDF invoices and mark rows as invoiced.
        </p>
      </div>

      {groupKeys.length === 0 && (
        <div className="rounded-2xl border bg-card px-5 py-12 text-center text-muted-foreground">
          No earnings recorded yet.
        </div>
      )}

      {groupKeys.map((key) => {
        const rows = groups[key];
        const partner = rows[0].partner!;
        const [yearMonth] = key.split("::");
        const [year, month] = yearMonth.split("-");
        const monthLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", {
          month: "long",
          year: "numeric",
        });
        const total = rows.reduce((s, r) => s + Number(r.amount_xcd), 0);
        const allInvoiced = rows.every((r) => r.status === "invoiced" || r.status === "paid");
        const allPaid = rows.every((r) => r.status === "paid");
        const hasInvoiced = rows.some((r) => r.status === "invoiced");

        return (
          <section key={key} className="rounded-2xl border bg-card">
            <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  {monthLabel}
                </p>
                <h2 className="font-display text-xl">{partner.business_name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {partner.email} · Fee:{" "}
                  {partner.fee_agreement_type === "flat"
                    ? `Flat ${formatXCD(partner.fee_rate)}/booking`
                    : `${partner.fee_rate}% per booking`}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap justify-end">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Total fees</div>
                  <div className="font-display text-xl">{formatXCD(total)}</div>
                </div>
                {hasInvoiced && !allPaid && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-mint/50 text-primary hover:bg-mint/10"
                    onClick={() => markGroupPaid(key)}
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Mark all paid
                  </Button>
                )}
                {allPaid && (
                  <Badge variant="outline" className="bg-mint/20 text-primary border-mint/40 px-3 py-1.5">
                    <CheckCircle className="h-3 w-3 mr-1.5" /> Paid
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant={allInvoiced ? "outline" : "default"}
                  className="gap-1.5"
                  disabled={generating === key}
                  onClick={() => generateInvoice(key)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {generating === key
                    ? "Generating…"
                    : allInvoiced
                    ? "Re-generate PDF"
                    : "Generate invoice"}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date confirmed</th>
                    <th className="px-5 py-3 font-medium">Traveller</th>
                    <th className="px-5 py-3 font-medium">Property</th>
                    <th className="px-5 py-3 font-medium">Room</th>
                    <th className="px-5 py-3 font-medium">Nights</th>
                    <th className="px-5 py-3 font-medium">Booking total</th>
                    <th className="px-5 py-3 font-medium">Fee rate</th>
                    <th className="px-5 py-3 font-medium">Finder's fee</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => {
                    const b = r.booking;
                    const isPaid = r.status === "paid";
                    return (
                      <tr key={r.id} className={isPaid ? "opacity-60" : ""}>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs">
                          {formatDate(b?.check_in)}
                        </td>
                        <td className="px-5 py-3.5 font-medium">
                          {b?.traveller?.full_name ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {b?.property?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {b?.room?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">{b?.nights ?? "—"}</td>
                        <td className="px-5 py-3.5">{formatXCD(b?.total_xcd ?? 0)}</td>
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {b?.fee_type === "flat"
                            ? `Flat`
                            : b?.fee_rate != null
                            ? `${b.fee_rate}%`
                            : "—"}
                        </td>
                        <td className="px-5 py-3.5 font-medium">{formatXCD(r.amount_xcd)}</td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant="outline"
                            className={`capitalize text-xs ${isPaid ? "bg-mint/20 text-primary border-mint/40" : ""}`}
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {!isPaid && r.status === "invoiced" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary hover:bg-mint/10"
                              disabled={markingPaid === r.id}
                              onClick={() => markRowPaid(r)}
                            >
                              <CheckCircle className="h-3 w-3" />
                              {markingPaid === r.id ? "…" : "Paid"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

// ─── Group earnings by partner × month ───────────────────────────────────────

function groupEarnings(rows: EarningRow[]): Record<GroupKey, EarningRow[]> {
  const out: Record<GroupKey, EarningRow[]> = {};
  for (const row of rows) {
    if (!row.partner) continue;
    const d = new Date(row.created_at);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const key = `${ym}::${row.partner.id}`;
    if (!out[key]) out[key] = [];
    out[key].push(row);
  }
  return out;
}

// ─── PDF builder ─────────────────────────────────────────────────────────────

function buildPDF(opts: {
  rows: EarningRow[];
  partner: NonNullable<EarningRow["partner"]>;
  invoiceNum: string;
  invoiceDate: Date;
  dueDate: Date;
  year: string;
  month: string;
}): jsPDF {
  const { rows, partner, invoiceNum, invoiceDate, dueDate } = opts;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header background
  doc.setFillColor(29, 78, 58); // #1D4E3A
  doc.rect(0, 0, W, 42, "F");

  // Header text
  doc.setFont("georgia", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("StayLink SVG", 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 230, 215);
  doc.text("ST. VINCENT & THE GRENADINES LODGING NETWORK", 14, 26);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("INVOICE", W - 14, 18, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(200, 230, 215);
  doc.text(invoiceNum, W - 14, 26, { align: "right" });

  // Invoice meta
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");

  let y = 52;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("BILL TO", 14, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  doc.text(partner.business_name, 14, y);
  y += 4.5;
  doc.text(partner.contact_name, 14, y);
  y += 4.5;
  doc.text(partner.email, 14, y);
  y += 4.5;
  const feeLabel =
    partner.fee_agreement_type === "flat"
      ? `Flat EC$${partner.fee_rate}/booking`
      : `${partner.fee_rate}% per booking`;
  doc.text(`Fee agreement: ${feeLabel}`, 14, y);

  // Invoice dates on right
  doc.setFont("helvetica", "bold");
  doc.text("Invoice date:", W - 60, 52);
  doc.text("Due date:", W - 60, 56.5);
  doc.setFont("helvetica", "normal");
  doc.text(fmtDate(invoiceDate), W - 14, 52, { align: "right" });
  doc.text(fmtDate(dueDate), W - 14, 56.5, { align: "right" });

  y += 10;

  // Line items table
  const tableRows = rows.map((r) => {
    const b = r.booking;
    const feeRateStr =
      b?.fee_type === "flat" ? "Flat" : b?.fee_rate != null ? `${b.fee_rate}%` : "—";
    return [
      fmtDate(b?.check_in ? new Date(b.check_in) : null),
      b?.traveller?.full_name ?? "—",
      b?.property?.name ?? "—",
      b?.room?.name ?? "—",
      String(b?.nights ?? "—"),
      `EC$ ${Number(b?.total_xcd ?? 0).toLocaleString("en-US")}`,
      feeRateStr,
      `EC$ ${Number(r.amount_xcd).toLocaleString("en-US")}`,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Date", "Traveller", "Property", "Room", "Nights", "Booking Total", "Rate", "Fee"]],
    body: tableRows,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [29, 78, 58], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: [247, 245, 241] },
    columnStyles: {
      0: { cellWidth: 20 },
      4: { halign: "center", cellWidth: 12 },
      5: { halign: "right" },
      6: { halign: "center", cellWidth: 14 },
      7: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  // Total
  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  const total = rows.reduce((s, r) => s + Number(r.amount_xcd), 0);

  doc.setFillColor(29, 78, 58);
  doc.rect(W - 80, finalY - 4, 66, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TOTAL FINDER'S FEES DUE", W - 77, finalY + 2);
  doc.text(`EC$ ${total.toLocaleString("en-US")}`, W - 14, finalY + 2, { align: "right" });

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  const pageH = doc.internal.pageSize.getHeight();
  doc.text(
    "StayLink SVG  ·  staylinksvg.com  ·  St. Vincent and the Grenadines",
    W / 2,
    pageH - 10,
    { align: "center" }
  );

  return doc;
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
