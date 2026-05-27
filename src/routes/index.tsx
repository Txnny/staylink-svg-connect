import { createFileRoute, Link } from "@tanstack/react-router";
import { Waves, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StayLink SVG — Lodging redirect platform" },
      { name: "description", content: "Connecting displaced travellers with the right room across St. Vincent and the Grenadines." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-6 lg:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Waves className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg leading-tight">StayLink</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">SVG</div>
          </div>
        </div>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/request" className="px-3 py-2 rounded-lg hover:bg-muted">Need a room</Link>
          <Link to="/partner/onboard" className="px-3 py-2 rounded-lg hover:bg-muted">List your property</Link>
          <Link to="/admin" className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary-glow">
            Admin
          </Link>
        </nav>
      </header>

      <main className="px-6 lg:px-10 pt-16 lg:pt-28 pb-20 max-w-5xl mx-auto">
        <p className="text-xs uppercase tracking-[0.25em] text-primary font-medium">
          St. Vincent &amp; the Grenadines
        </p>
        <h1 className="mt-4 font-display text-5xl lg:text-7xl leading-[0.95]">
          When the room falls through, <span className="text-primary">we find you another.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          StayLink SVG matches displaced travellers with vetted hotels, guesthouses, villas and
          hostels across the islands — usually within the hour.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/request"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-medium text-primary-foreground hover:bg-primary-glow"
          >
            Find me a room <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/partner/onboard"
            className="inline-flex items-center gap-2 rounded-xl border border-input bg-card px-6 py-3.5 text-base font-medium hover:bg-muted"
          >
            List your property
          </Link>
        </div>
      </main>
    </div>
  );
}
