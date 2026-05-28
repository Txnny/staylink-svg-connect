import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatXCD } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, UserCheck, Mail, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/partners")({
  component: PartnersPage,
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
  joined_at: string;
  user_id: string | null;
};

function PartnersPage() {
  const qc = useQueryClient();
  const [approving, setApproving] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | Partner["status"]>("all");

  const list = useQuery({
    queryKey: ["admin", "partners", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("partners")
        .select("id, business_name, contact_name, email, phone, parish, room_count, fee_agreement_type, fee_rate, status, joined_at, user_id")
        .order("joined_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Partner[];
    },
  });

  async function approve(p: Partner) {
    setApproving(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("approve-partner", {
        body: { partner_id: p.id },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success(`Partner approved. Invite sent to ${p.email}.`);
      qc.invalidateQueries({ queryKey: ["admin", "partners"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve partner");
    } finally {
      setApproving(null);
    }
  }

  return (
    <div className="px-6 lg:px-10 py-8 max-w-7xl mx-auto space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Network</p>
        <h1 className="font-display text-3xl lg:text-4xl mt-1">Partners</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Review and approve onboarding partners. Approval sends a magic-link invite to their email.
        </p>
      </header>

      <div className="flex gap-2 flex-wrap">
        {(["all", "onboarding", "active", "inactive"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs uppercase tracking-wider px-3 py-1.5 rounded-full border transition ${
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
              <tr>
                <th className="px-5 py-3 font-medium">Business</th>
                <th className="px-5 py-3 font-medium">Contact</th>
                <th className="px-5 py-3 font-medium">Parish</th>
                <th className="px-5 py-3 font-medium">Rooms</th>
                <th className="px-5 py-3 font-medium">Fee</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.isLoading && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!list.isLoading && (list.data?.length ?? 0) === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No partners.</td></tr>
              )}
              {list.data?.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-5 py-3.5">
                    <div className="font-medium">{p.business_name}</div>
                    <div className="text-xs text-muted-foreground">{p.contact_name}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" /> {p.email}
                    </div>
                    {p.phone && <div className="text-xs text-muted-foreground mt-0.5">{p.phone}</div>}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {p.parish ? (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.parish}</span>
                    ) : "—"}
                  </td>
                  <td className="px-5 py-3.5">{p.room_count ?? "—"}</td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">
                    {p.fee_agreement_type === "flat"
                      ? `${formatXCD(p.fee_rate)} flat`
                      : `${p.fee_rate}%`}
                  </td>
                  <td className="px-5 py-3.5"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{formatDate(p.joined_at)}</td>
                  <td className="px-5 py-3.5 text-right">
                    {p.status === "onboarding" && (
                      <Button
                        size="sm"
                        onClick={() => approve(p)}
                        disabled={approving === p.id}
                      >
                        {approving === p.id
                          ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          : <UserCheck className="h-3.5 w-3.5 mr-1.5" />}
                        Approve
                      </Button>
                    )}
                    {p.status === "active" && p.user_id && (
                      <span className="text-xs text-muted-foreground">Active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Partner["status"] }) {
  const tone: Record<Partner["status"], string> = {
    onboarding: "bg-amber/20 text-amber-foreground border-amber/40",
    active: "bg-mint/30 text-primary border-mint/50",
    paused: "bg-muted text-muted-foreground border-border",
    removed: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return <Badge variant="outline" className={`capitalize ${tone[status]}`}>{status}</Badge>;
}
