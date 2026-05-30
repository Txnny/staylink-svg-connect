import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { PARISHES } from "@/lib/emails";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Plus, Pencil, Building2, BedDouble, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/properties")({
  component: AdminPropertiesPage,
});

const PROPERTY_TYPES = ["hotel", "airbnb", "guesthouse", "hostel", "villa"] as const;
const PROPERTY_STATUSES = ["active", "inactive", "onboarding"] as const;

type Property = {
  id: string;
  name: string;
  type: string;
  parish: string | null;
  address: string | null;
  description: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website: string | null;
  status: string;
  created_at: string;
  partner_id: string | null;
  rating: number | null;
  partner: { id: string; business_name: string } | null;
  rooms: { id: string; name: string; room_type: string | null; available: boolean }[];
};

type FormValues = {
  name: string;
  type: string;
  parish: string;
  address: string;
  description: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  website: string;
  status: string;
  partner_id: string;
};

function AdminPropertiesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialog, setDialog] = useState<{ open: boolean; editing: Property | null }>({
    open: false,
    editing: null,
  });

  const properties = useQuery({
    queryKey: ["admin-properties", statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("properties")
        .select(
          `id, name, type, parish, address, description, contact_name, contact_email,
           contact_phone, website, status, created_at, partner_id, rating,
           partner:partners(id, business_name),
           rooms(id, name, room_type, available)`
        )
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as "active" | "inactive" | "onboarding");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Property[];
    },
  });

  const filtered = (properties.data ?? []).filter((p) =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.partner as { business_name?: string } | null)?.business_name
      ?.toLowerCase()
      .includes(search.toLowerCase()) ||
    (p.parish ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["admin-properties"] });
  }

  return (
    <div className="px-6 lg:px-10 py-8 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Inventory</p>
          <h1 className="font-display text-3xl lg:text-4xl mt-1">Properties</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {properties.data?.length ?? 0} total · manage listings and rooms
          </p>
        </div>
        <Button
          onClick={() => setDialog({ open: true, editing: null })}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add property
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end rounded-xl border bg-card p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Search</label>
          <Input
            placeholder="Name, partner, parish…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            {PROPERTY_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">{s}</option>
            ))}
          </select>
        </div>
        {(search || statusFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Properties accordion list */}
      {properties.isLoading && (
        <div className="py-16 text-center text-muted-foreground">Loading properties…</div>
      )}

      {!properties.isLoading && filtered.length === 0 && (
        <div className="rounded-2xl border bg-card py-16 text-center text-muted-foreground">
          No properties found.
        </div>
      )}

      {filtered.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b bg-muted/50 grid grid-cols-[2fr_1fr_1fr_80px_80px_40px] gap-4 text-xs uppercase tracking-wider text-muted-foreground font-medium">
            <span>Property</span>
            <span>Partner</span>
            <span>Parish</span>
            <span>Rooms</span>
            <span>Status</span>
            <span />
          </div>
          <Accordion type="multiple">
            {filtered.map((p) => {
              const partnerObj = p.partner as { business_name?: string } | null;
              const roomList = p.rooms ?? [];
              const availRooms = roomList.filter((r) => r.available).length;
              return (
                <AccordionItem key={p.id} value={p.id} className="border-b last:border-0">
                  <AccordionTrigger className="px-5 py-3.5 hover:no-underline hover:bg-muted/30 [&>svg]:hidden">
                    <div className="w-full grid grid-cols-[2fr_1fr_1fr_80px_80px_40px] gap-4 items-center text-left">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{p.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">{p.type}</div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {partnerObj?.business_name ?? <span className="italic">Unlinked</span>}
                      </div>
                      <div className="text-sm text-muted-foreground">{p.parish ?? "—"}</div>
                      <div className="flex items-center gap-1 text-sm">
                        <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{availRooms}/{roomList.length}</span>
                      </div>
                      <div><StatusBadge status={p.status} /></div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialog({ open: true, editing: p });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-0">
                    <PropertyDetail property={p} onEdit={() => setDialog({ open: true, editing: p })} />
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}

      <PropertyDialog
        open={dialog.open}
        editing={dialog.editing}
        onClose={() => setDialog({ open: false, editing: null })}
        onSaved={invalidate}
      />
    </div>
  );
}

// ─── Property detail (expanded) ───────────────────────────────────────────────

function PropertyDetail({ property: p }: { property: Property; onEdit: () => void }) {
  const rooms = p.rooms ?? [];
  return (
    <div className="border-t bg-muted/20 px-5 py-4 space-y-4">
      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {[
          ["Address", p.address],
          ["Contact name", p.contact_name],
          ["Email", p.contact_email],
          ["Phone", p.contact_phone],
          ["Website", p.website],
          ["Added", formatDate(p.created_at)],
          ["Rating", p.rating != null ? `${p.rating}/5` : "—"],
          ["Description", p.description],
        ].map(([label, val]) => (
          <div key={label as string}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-0.5 truncate">{val || "—"}</div>
          </div>
        ))}
      </div>

      {/* Rooms sub-table */}
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Rooms ({rooms.length})
        </div>
        {rooms.length === 0 ? (
          <div className="text-sm text-muted-foreground italic">No rooms added yet.</div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rooms.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 font-medium">{r.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground capitalize">
                      {r.room_type ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={r.available ? "default" : "outline"} className="text-xs">
                        {r.available ? "Yes" : "No"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Property dialog ──────────────────────────────────────────────────────────

function PropertyDialog({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: Property | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const partners = useQuery({
    queryKey: ["admin-partners-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("id, business_name")
        .order("business_name");
      return data ?? [];
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      type: "guesthouse",
      parish: "Kingstown",
      address: "",
      description: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      website: "",
      status: "active",
      partner_id: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    const partnerObj = editing?.partner as { id?: string } | null;
    reset(
      editing
        ? {
            name: editing.name,
            type: editing.type,
            parish: editing.parish ?? "Kingstown",
            address: editing.address ?? "",
            description: editing.description ?? "",
            contact_name: editing.contact_name ?? "",
            contact_email: editing.contact_email ?? "",
            contact_phone: editing.contact_phone ?? "",
            website: editing.website ?? "",
            status: editing.status,
            partner_id: partnerObj?.id ?? "",
          }
        : {
            name: "",
            type: "guesthouse",
            parish: "Kingstown",
            address: "",
            description: "",
            contact_name: "",
            contact_email: "",
            contact_phone: "",
            website: "",
            status: "active",
            partner_id: "",
          }
    );
  }, [open, editing, reset]);

  async function onSubmit(values: FormValues) {
    const payload = {
      name: values.name,
      type: values.type as "hotel" | "airbnb" | "guesthouse" | "hostel" | "villa",
      parish: values.parish,
      address: values.address || null,
      description: values.description || null,
      contact_name: values.contact_name || null,
      contact_email: values.contact_email || null,
      contact_phone: values.contact_phone || null,
      website: values.website || null,
      status: values.status as "active" | "inactive" | "onboarding",
      partner_id: values.partner_id || null,
    };

    if (editing) {
      const { error } = await supabase.from("properties").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Property updated");
    } else {
      const { error } = await supabase.from("properties").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Property added");
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing ? "Edit property" : "Add property"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Property name *" className="col-span-2">
              <Input {...register("name", { required: true })} placeholder="Sunset Guesthouse" />
            </FormField>

            <FormField label="Type *">
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Status *">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROPERTY_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Parish *">
              <Controller
                control={control}
                name="parish"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PARISHES.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Partner">
              <Controller
                control={control}
                name="partner_id"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Unlinked" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unlinked</SelectItem>
                      {(partners.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.business_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <FormField label="Address">
            <Input {...register("address")} placeholder="123 Bay Street, Kingstown" />
          </FormField>

          <FormField label="Description">
            <Textarea {...register("description")} rows={3} placeholder="Brief property description…" />
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Contact name">
              <Input {...register("contact_name")} placeholder="John Smith" />
            </FormField>
            <FormField label="Contact email">
              <Input {...register("contact_email")} type="email" placeholder="john@example.com" />
            </FormField>
            <FormField label="Contact phone">
              <Input {...register("contact_phone")} placeholder="+1 784 000 0000" />
            </FormField>
          </div>

          <FormField label="Website">
            <Input {...register("website")} placeholder="https://…" />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : editing ? "Save changes" : "Add property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FormField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: "bg-mint/20 text-primary border-mint/40",
    inactive: "bg-muted text-muted-foreground border-border",
    onboarding: "bg-amber/20 text-amber-foreground border-amber/40",
  };
  return (
    <Badge variant="outline" className={`capitalize text-xs ${tone[status] ?? ""}`}>
      {status}
    </Badge>
  );
}
