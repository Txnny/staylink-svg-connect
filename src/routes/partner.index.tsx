import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { formatXCD, formatDate } from "@/lib/format";
import { PARISHES } from "@/lib/emails";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Building2, BedDouble, Coins, ArrowRightLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/partner/")({
  component: PartnerDashboard,
});

const PROPERTY_TYPES = ["hotel", "airbnb", "guesthouse", "hostel", "villa"] as const;
const ROOM_TYPES = ["single", "double", "twin", "suite", "dormitory", "entire_unit"] as const;
const AMENITIES = ["wifi", "AC", "kitchen", "parking", "ocean view", "breakfast included", "hot water", "TV"];

type PropertyFormValues = {
  name: string;
  type: string;
  parish: string;
  address: string;
  description: string;
  contact_phone: string;
  website: string;
};

type RoomFormValues = {
  name: string;
  room_type: string;
  max_guests: number;
  price_per_night_xcd: number;
  available_from: string;
  available_to: string;
};

type RoomRow = {
  id: string;
  name: string;
  room_type: string | null;
  max_guests: number;
  price_per_night_xcd: number;
  available: boolean;
  available_from: string | null;
  available_to: string | null;
  amenities: string[] | null;
};

type PropertyRow = {
  id: string;
  name: string;
  type: string;
  parish: string | null;
  address: string | null;
  description: string | null;
  contact_phone: string | null;
  website: string | null;
  status: string;
  rooms: RoomRow[];
};

// ─── Main dashboard ───────────────────────────────────────────────────────────

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
        .select(
          "id, name, type, parish, address, description, contact_phone, website, status, rooms(id, name, room_type, max_guests, price_per_night_xcd, available, available_from, available_to, amenities)"
        )
        .eq("partner_id", partner.data!.id);
      return (data ?? []) as PropertyRow[];
    },
  });

  const rooms = useQuery({
    queryKey: ["partner-rooms", partner.data?.id],
    enabled: !!partner.data?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("rooms")
        .select(
          "id, name, room_type, price_per_night_xcd, max_guests, available, property:properties!inner(id, name, partner_id)"
        )
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
        .select(
          `id, status, created_at, matched:properties!redirects_matched_property_id_fkey!inner(name, partner_id),
           traveller:travellers(full_name, nights_needed)`
        )
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
      const startMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      ).toISOString();
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
    return (
      <div className="max-w-6xl mx-auto px-5 lg:px-8 py-10 text-muted-foreground">
        Loading your portal…
      </div>
    );
  }

  if (!partner.data) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-16 text-center">
        <h1 className="font-display text-3xl">Almost there.</h1>
        <p className="mt-3 text-muted-foreground">
          Your account is signed in but isn't linked to a partner profile yet. Our team will finish
          your onboarding shortly. If this is unexpected, please contact StayLink support.
        </p>
      </div>
    );
  }

  const availableRooms = (properties.data ?? []).flatMap((p) =>
    p.rooms.filter((r) => r.available)
  ).length;
  const totalRooms = (properties.data ?? []).flatMap((p) => p.rooms).length;

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
          value={availableRooms}
          hint={`of ${totalRooms} total`}
        />
        <Metric
          icon={Coins}
          label="Earnings this month"
          value={formatXCD(earnings.data?.month ?? 0)}
          hint="Paid out"
        />
        <Metric icon={Coins} label="All-time earnings" value={formatXCD(earnings.data?.all ?? 0)} />
      </section>

      {/* Properties with rooms — accordion CRUD */}
      <PropertiesSection partnerId={partner.data.id} properties={properties.data ?? []} />

      {/* Rooms manager — availability toggles */}
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
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    No redirects yet.
                  </td>
                </tr>
              )}
              {redirects.data?.map((r) => {
                const t = r.traveller as { full_name?: string; nights_needed?: number } | null;
                const m = r.matched as { name?: string } | null;
                return (
                  <tr key={r.id}>
                    <td className="px-5 py-3.5 font-medium">{t?.full_name ?? "—"}</td>
                    <td className="px-5 py-3.5">{t?.nights_needed ?? "—"}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{m?.name ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant="outline" className="capitalize">
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">
                      {formatDate(r.created_at)}
                    </td>
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

// ─── Properties section ───────────────────────────────────────────────────────

function PropertiesSection({
  partnerId,
  properties,
}: {
  partnerId: string;
  properties: PropertyRow[];
}) {
  const qc = useQueryClient();
  const [propertyDialog, setPropertyDialog] = useState<{
    open: boolean;
    editing: PropertyRow | null;
  }>({ open: false, editing: null });
  const [roomDialog, setRoomDialog] = useState<{
    open: boolean;
    propertyId: string;
    editing: RoomRow | null;
  }>({ open: false, propertyId: "", editing: null });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["partner-properties"] });
    qc.invalidateQueries({ queryKey: ["partner-rooms"] });
  }

  async function softDeleteRoom(id: string) {
    const { error } = await supabase.from("rooms").update({ available: false }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Room removed from availability");
    invalidate();
  }

  return (
    <section className="rounded-2xl border bg-card">
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl">Your properties</h2>
          <p className="text-xs text-muted-foreground">Manage properties and rooms.</p>
        </div>
        <Button
          size="sm"
          onClick={() => setPropertyDialog({ open: true, editing: null })}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add property
        </Button>
      </div>

      {properties.length === 0 ? (
        <div className="px-5 py-10 text-center text-muted-foreground text-sm">
          No properties yet. Add your first property to get started.
        </div>
      ) : (
        <Accordion type="multiple" className="px-5 py-3 space-y-2">
          {properties.map((prop) => (
            <AccordionItem
              key={prop.id}
              value={prop.id}
              className="border rounded-xl overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:ml-auto">
                <div className="flex items-center gap-3 flex-1 text-left">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{prop.name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {prop.type} · {prop.parish ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mr-3">
                    <Badge variant="outline" className="capitalize text-xs">
                      {prop.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {prop.rooms.filter((r) => r.available).length}/{prop.rooms.length} rooms
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPropertyDialog({ open: true, editing: prop });
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-muted/50">
                      <tr>
                        <th className="px-5 py-3 font-medium">Room</th>
                        <th className="px-5 py-3 font-medium">Type</th>
                        <th className="px-5 py-3 font-medium">Guests</th>
                        <th className="px-5 py-3 font-medium">Rate / night</th>
                        <th className="px-5 py-3 font-medium">Available</th>
                        <th className="px-5 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {prop.rooms.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">
                            No rooms yet.
                          </td>
                        </tr>
                      )}
                      {prop.rooms.map((room) => (
                        <tr key={room.id}>
                          <td className="px-5 py-3.5 font-medium">{room.name}</td>
                          <td className="px-5 py-3.5 capitalize text-muted-foreground">
                            {room.room_type ?? "—"}
                          </td>
                          <td className="px-5 py-3.5">{room.max_guests}</td>
                          <td className="px-5 py-3.5">{formatXCD(room.price_per_night_xcd)}</td>
                          <td className="px-5 py-3.5">
                            <Badge
                              variant={room.available ? "default" : "outline"}
                              className="text-xs"
                            >
                              {room.available ? "Yes" : "No"}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                  setRoomDialog({
                                    open: true,
                                    propertyId: prop.id,
                                    editing: room,
                                  })
                                }
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => softDeleteRoom(room.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() =>
                      setRoomDialog({ open: true, propertyId: prop.id, editing: null })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add room
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <PropertyDialog
        open={propertyDialog.open}
        editing={propertyDialog.editing}
        partnerId={partnerId}
        onClose={() => setPropertyDialog({ open: false, editing: null })}
        onSaved={invalidate}
      />

      <RoomDialog
        open={roomDialog.open}
        propertyId={roomDialog.propertyId}
        editing={roomDialog.editing}
        onClose={() => setRoomDialog({ open: false, propertyId: "", editing: null })}
        onSaved={invalidate}
      />
    </section>
  );
}

// ─── Property dialog ──────────────────────────────────────────────────────────

function PropertyDialog({
  open,
  editing,
  partnerId,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: PropertyRow | null;
  partnerId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<PropertyFormValues>({
    defaultValues: {
      name: "",
      type: "guesthouse",
      parish: "Kingstown",
      address: "",
      description: "",
      contact_phone: "",
      website: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              type: editing.type,
              parish: editing.parish ?? "Kingstown",
              address: editing.address ?? "",
              description: editing.description ?? "",
              contact_phone: editing.contact_phone ?? "",
              website: editing.website ?? "",
            }
          : {
              name: "",
              type: "guesthouse",
              parish: "Kingstown",
              address: "",
              description: "",
              contact_phone: "",
              website: "",
            }
      );
    }
  }, [open, editing, reset]);

  async function onSubmit(values: PropertyFormValues) {
    const payload = {
      name: values.name,
      type: values.type as "hotel" | "airbnb" | "guesthouse" | "hostel" | "villa",
      parish: values.parish,
      address: values.address || null,
      description: values.description || null,
      contact_phone: values.contact_phone || null,
      website: values.website || null,
    };

    if (editing) {
      const { error } = await supabase.from("properties").update(payload).eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Property updated");
    } else {
      const { error } = await supabase.from("properties").insert({
        ...payload,
        partner_id: partnerId,
        status: "active",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Property added");
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing ? "Edit property" : "Add property"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <FormField label="Property name *">
            <Input {...register("name", { required: true })} placeholder="Sunset Guesthouse" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type *">
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t}
                        </SelectItem>
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
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PARISHES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
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
            <Textarea {...register("description")} rows={3} placeholder="Brief description…" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contact phone">
              <Input {...register("contact_phone")} placeholder="+1 784 000 0000" />
            </FormField>
            <FormField label="Website (optional)">
              <Input {...register("website")} placeholder="https://…" />
            </FormField>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : editing ? "Save changes" : "Add property"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Room dialog ──────────────────────────────────────────────────────────────

function RoomDialog({
  open,
  propertyId,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  propertyId: string;
  editing: RoomRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<RoomFormValues>({
    defaultValues: {
      name: "",
      room_type: "double",
      max_guests: 2,
      price_per_night_xcd: 0,
      available_from: "",
      available_to: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        editing
          ? {
              name: editing.name,
              room_type: editing.room_type ?? "double",
              max_guests: editing.max_guests,
              price_per_night_xcd: editing.price_per_night_xcd,
              available_from: editing.available_from ?? "",
              available_to: editing.available_to ?? "",
            }
          : {
              name: "",
              room_type: "double",
              max_guests: 2,
              price_per_night_xcd: 0,
              available_from: "",
              available_to: "",
            }
      );
      setSelectedAmenities(editing?.amenities ?? []);
    }
  }, [open, editing, reset]);

  function toggleAmenity(a: string) {
    setSelectedAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  }

  async function onSubmit(values: RoomFormValues) {
    const payload = {
      name: values.name,
      room_type: values.room_type,
      max_guests: Number(values.max_guests),
      price_per_night_xcd: Number(values.price_per_night_xcd),
      available_from: values.available_from || null,
      available_to: values.available_to || null,
      amenities: selectedAmenities,
    };

    if (editing) {
      const { error } = await supabase.from("rooms").update(payload).eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Room updated");
    } else {
      const { error } = await supabase
        .from("rooms")
        .insert({ ...payload, property_id: propertyId, available: true });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Room added");
    }
    onSaved();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {editing ? "Edit room" : "Add room"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <FormField label="Room name *">
            <Input {...register("name", { required: true })} placeholder="Ocean View Double" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Room type *">
              <Controller
                control={control}
                name="room_type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOM_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="capitalize">
                          {t.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Max guests *">
              <Input
                type="number"
                min={1}
                {...register("max_guests", { required: true, min: 1 })}
              />
            </FormField>
          </div>

          <FormField label="Price per night (XCD) *">
            <Input
              type="number"
              min={0}
              step="0.01"
              {...register("price_per_night_xcd", { required: true, min: 0 })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Available from">
              <Input type="date" {...register("available_from")} />
            </FormField>
            <FormField label="Available to">
              <Input type="date" {...register("available_to")} />
            </FormField>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Amenities
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {AMENITIES.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedAmenities.includes(a)}
                    onCheckedChange={() => toggleAmenity(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : editing ? "Save changes" : "Add room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
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
    return (
      <div className="px-5 py-8 text-center text-muted-foreground text-sm">
        No rooms added yet.
      </div>
    );
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
                  {r.room_type && (
                    <div className="text-xs text-muted-foreground capitalize">{r.room_type}</div>
                  )}
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
