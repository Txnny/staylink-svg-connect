import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Waves, LogOut } from "lucide-react";

export const Route = createFileRoute("/partner")({
  component: PartnerShell,
});

function PartnerShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const isPublic = pathname === "/partner/login" || pathname === "/partner/onboard";

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (ready && !session && !isPublic) {
      navigate({ to: "/partner/login", replace: true });
    }
  }, [ready, session, isPublic, navigate]);

  if (isPublic) return <Outlet />;
  if (!ready) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  }
  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 py-4 flex items-center justify-between">
          <Link to="/partner" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Waves className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-lg leading-tight">StayLink</div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">SVG · Partner portal</div>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">{session.user.email}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/partner/login", replace: true });
              }}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
