import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Waves, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/request")({
  head: () => ({
    meta: [
      { title: "Find me a room — StayLink SVG" },
      {
        name: "description",
        content:
          "Tell us your dates and we'll match you with a vetted hotel, guesthouse, villa or hostel across St. Vincent and the Grenadines — usually within the hour.",
      },
    ],
  }),
  component: RequestPage,
});

const Schema = z.object({
  full_name: z.string().trim().min(1, "Required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  arrival_date: z.string().min(1, "Required"),
  departure_date: z.string().min(1, "Required"),
  guest_count: z.coerce.number().int().min(1).max(20),
  budget_max_xcd: z.coerce.number().min(0).max(10000).optional(),
  accommodation_type_preference: z
    .enum(["any", "hotel", "guesthouse", "villa", "hostel", "airbnb"])
    .optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
  source: z.enum(["referral", "airport", "online", "word_of_mouth", "other"]),
});

type FormState = z.infer<typeof Schema>;

function RequestPage() {
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
    const arr = new Date(parsed.data.arrival_date);
    const dep = new Date(parsed.data.departure_date);
    const nights = Math.max(
      1,
      Math.round((dep.getTime() - arr.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const type =
      parsed.data.accommodation_type_preference &&
      parsed.data.accommodation_type_preference !== "any"
        ? parsed.data.accommodation_type_preference
        : null;
    const { error } = await supabase.from("travellers").insert({
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      arrival_date: parsed.data.arrival_date,
      departure_date: parsed.data.departure_date,
      nights_needed: nights,
      guest_count: parsed.data.guest_count,
      budget_max_xcd: parsed.data.budget_max_xcd ?? null,
      accommodation_type_preference: type,
      notes: parsed.data.notes || null,
      source: parsed.data.source,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message || "Could not submit. Try again.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background grid place-items-center px-6 py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint text-mint-foreground">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="mt-6 font-display text-4xl">We're on it.</h1>
          <p className="mt-3 text-muted-foreground">
            You'll hear from us within the hour with vetted room options across the islands.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 text-sm text-primary hover:text-primary-glow"
          >
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
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">SVG</div>
          </div>
        </Link>
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          Cancel
        </Link>
      </header>

      <main className="px-5 lg:px-10 py-10 lg:py-16 max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-[0.25em] text-primary font-medium">
          Request a room
        </p>
        <h1 className="mt-3 font-display text-4xl lg:text-5xl leading-[1.05]">
          Tell us where you're stuck.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Share your dates and preferences. Our team will reach out within the hour with
          vetted options.
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-6">
          <Field label="Full name" error={errors.full_name}>
            <input name="full_name" required className={inputCls} autoComplete="name" />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Email" error={errors.email}>
              <input name="email" type="email" required className={inputCls} autoComplete="email" />
            </Field>
            <Field label="Phone (optional)" error={errors.phone}>
              <input name="phone" type="tel" className={inputCls} autoComplete="tel" />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Arrival date" error={errors.arrival_date}>
              <input name="arrival_date" type="date" required className={inputCls} />
            </Field>
            <Field label="Departure date" error={errors.departure_date}>
              <input name="departure_date" type="date" required className={inputCls} />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Guests" error={errors.guest_count}>
              <input
                name="guest_count"
                type="number"
                min={1}
                max={20}
                defaultValue={1}
                required
                className={inputCls}
              />
            </Field>
            <Field label="Budget per night (EC$)" error={errors.budget_max_xcd}>
              <input
                name="budget_max_xcd"
                type="number"
                min={0}
                step={10}
                placeholder="e.g. 350"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Accommodation type" error={errors.accommodation_type_preference}>
            <select name="accommodation_type_preference" defaultValue="any" className={inputCls}>
              <option value="any">Any</option>
              <option value="hotel">Hotel</option>
              <option value="guesthouse">Guesthouse</option>
              <option value="villa">Villa</option>
              <option value="hostel">Hostel</option>
              <option value="airbnb">Airbnb / short-let</option>
            </select>
          </Field>

          <Field label="Anything else we should know?" error={errors.notes}>
            <textarea
              name="notes"
              rows={4}
              placeholder="Accessibility needs, family with young children, late arrival…"
              className={inputCls}
              maxLength={1000}
            />
          </Field>

          <Field label="How did you hear about us?" error={errors.source}>
            <select name="source" defaultValue="online" required className={inputCls}>
              <option value="referral">Hotel referral</option>
              <option value="airport">Airport</option>
              <option value="online">Online search</option>
              <option value="word_of_mouth">Word of mouth</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-primary px-6 py-4 text-base font-medium text-primary-foreground hover:bg-primary-glow disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Find me a room"}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            We respond personally — no automated booking confirmations.
          </p>
        </form>
      </main>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-input bg-card px-3.5 py-3 text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}
