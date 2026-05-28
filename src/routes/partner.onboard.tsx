import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Waves, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PARISHES, sendEmail, templates } from "@/lib/emails";

export const Route = createFileRoute("/partner/onboard")({
  head: () => ({
    meta: [
      { title: "List your property — StayLink SVG" },
      {
        name: "description",
        content:
          "Partner with StayLink SVG. We send displaced travellers your way and only charge a finder's fee on confirmed bookings.",
      },
    ],
  }),
  component: PartnerOnboard,
});

const Schema = z.object({
  business_name: z.string().trim().min(1).max(150),
  property_type: z.enum(["hotel", "guesthouse", "villa", "hostel", "airbnb"]),
  parish: z.string().trim().min(1).max(80),
  room_count: z.coerce.number().int().min(1).max(500),
  contact_name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(4).max(40),
  fee_type: z.enum(["flat", "percentage"]),
  fee_rate: z.coerce.number().min(0).max(10000),
  heard_about: z.string().max(200).optional().or(z.literal("")),
});

type FormState = z.infer<typeof Schema>;

function PartnerOnboard() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());
    const parsed = Schema.safeParse(raw);
    if (!parsed.success) {
      const flat: Partial<Record<keyof FormState, string>> = {};
      for (const issue of parsed.error.issues) {
        flat[issue.path[0] as keyof FormState] = issue.message;
      }
      setErrors(flat);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSubmitting(true);
    const notes =
      `Property type: ${parsed.data.property_type}; Parish: ${parsed.data.parish}; ` +
      `Rooms: ${parsed.data.room_count}` +
      (parsed.data.heard_about ? `; Heard via: ${parsed.data.heard_about}` : "");

    const { error } = await supabase.from("partners").insert({
      business_name: parsed.data.business_name,
      contact_name: parsed.data.contact_name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      parish: parsed.data.parish,
      room_count: parsed.data.room_count,
      fee_agreement_type: parsed.data.fee_type,
      fee_rate: parsed.data.fee_rate,
      status: "onboarding",
      bank_details: notes,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Could not submit. Try again.");
      return;
    }

    // Fire-and-forget transactional emails.
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    sendEmail({
      to: parsed.data.email,
      subject: "Welcome to StayLink SVG — your application is received",
      html: templates.partnerOnboardingWelcome({
        businessName: parsed.data.business_name,
        contactName: parsed.data.contact_name,
      }),
    });
    sendEmail({
      to: import.meta.env.VITE_ADMIN_NOTIFICATION_EMAIL || "admin@staylinksvg.com",
      subject: `New partner application — ${parsed.data.business_name}`,
      html: templates.adminNewPartnerNotice({
        businessName: parsed.data.business_name,
        contactName: parsed.data.contact_name,
        propertyType: parsed.data.property_type,
        parish: parsed.data.parish,
        email: parsed.data.email,
        phone: parsed.data.phone,
        adminUrl: `${origin}/admin/partners`,
      }),
    });

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint text-mint-foreground">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-6 font-display text-4xl">Welcome to StayLink.</h1>
          <p className="mt-3 text-muted-foreground">
            We've received your application. Our team will be in touch within 1–2 business days to
            verify your property and set up your portal access.
          </p>
          <Link to="/" className="mt-8 inline-flex items-center gap-2 text-sm text-primary hover:text-primary-glow">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="px-5 lg:px-10 py-5 flex items-center justify-between border-b">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg leading-tight">StayLink</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">SVG · Partners</div>
          </div>
        </Link>
        <Link to="/partner/login" className="text-sm text-muted-foreground hover:text-foreground">
          Already a partner? Sign in
        </Link>
      </header>

      <main className="px-5 lg:px-10 py-10 lg:py-16 max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-[0.25em] text-primary font-medium">Partner application</p>
        <h1 className="mt-3 font-display text-4xl lg:text-5xl leading-[1.05]">
          List your property.
        </h1>
        <p className="mt-3 text-muted-foreground">
          We only earn when you do. A modest finder's fee on confirmed bookings — nothing
          upfront, no listing fees.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <Field label="Business name" error={errors.business_name}>
            <input name="business_name" required className={inputCls} />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Property type" error={errors.property_type}>
              <select name="property_type" defaultValue="hotel" required className={inputCls}>
                <option value="hotel">Hotel</option>
                <option value="guesthouse">Guesthouse</option>
                <option value="villa">Villa</option>
                <option value="hostel">Hostel</option>
                <option value="airbnb">Airbnb / short-let</option>
              </select>
            </Field>
            <Field label="Parish / location" error={errors.parish}>
              <input name="parish" required placeholder="e.g. Kingstown" className={inputCls} />
            </Field>
          </div>

          <Field label="Number of rooms" error={errors.room_count}>
            <input name="room_count" type="number" min={1} max={500} required defaultValue={1} className={inputCls} />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Contact name" error={errors.contact_name}>
              <input name="contact_name" required className={inputCls} autoComplete="name" />
            </Field>
            <Field label="Email" error={errors.email}>
              <input name="email" type="email" required className={inputCls} autoComplete="email" />
            </Field>
          </div>
          <Field label="Phone" error={errors.phone}>
            <input name="phone" type="tel" required className={inputCls} autoComplete="tel" />
          </Field>

          <fieldset className="rounded-xl border bg-card p-4">
            <legend className="px-1 text-sm font-medium">Finder's fee preference</legend>
            <div className="grid gap-4 sm:grid-cols-2 mt-2">
              <Field label="Fee type" error={errors.fee_type}>
                <select name="fee_type" defaultValue="percentage" required className={inputCls}>
                  <option value="percentage">Percentage of booking</option>
                  <option value="flat">Flat EC$ per booking</option>
                </select>
              </Field>
              <Field label="Amount (% or EC$)" error={errors.fee_rate}>
                <input name="fee_rate" type="number" min={0} step={0.5} required defaultValue={10} className={inputCls} />
              </Field>
            </div>
          </fieldset>

          <Field label="How did you hear about StayLink SVG? (optional)" error={errors.heard_about}>
            <input name="heard_about" className={inputCls} />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary px-6 py-4 text-base font-medium text-primary-foreground hover:bg-primary-glow disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Apply to partner"}
          </button>
        </form>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-input bg-card px-3.5 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}
