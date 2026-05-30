import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Globe,
  Key,
  Users,
  ShieldCheck,
  Database,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const admins = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role, created_at")
        .eq("role", "admin")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const partnerCount = useQuery({
    queryKey: ["admin-settings-counts"],
    queryFn: async () => {
      const [p, r, b] = await Promise.all([
        supabase.from("partners").select("id", { count: "exact", head: true }),
        supabase.from("rooms").select("id", { count: "exact", head: true }),
        supabase.from("bookings").select("id", { count: "exact", head: true }),
      ]);
      return { partners: p.count ?? 0, rooms: r.count ?? 0, bookings: b.count ?? 0 };
    },
  });

  return (
    <div className="px-6 lg:px-10 py-8 max-w-4xl mx-auto space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Admin</p>
        <h1 className="font-display text-3xl lg:text-4xl mt-1">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Platform configuration reference and admin account management.
        </p>
      </header>

      {/* Platform stats */}
      <section className="grid gap-4 grid-cols-3">
        <StatTile label="Partners" value={partnerCount.data?.partners ?? "—"} />
        <StatTile label="Total rooms" value={partnerCount.data?.rooms ?? "—"} />
        <StatTile label="Bookings" value={partnerCount.data?.bookings ?? "—"} />
      </section>

      {/* Environment config reference */}
      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="font-display text-xl">Environment configuration</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set these in your Supabase project → Edge Functions → Secrets.
          </p>
        </div>
        <div className="divide-y">
          <ConfigRow
            icon={Key}
            name="RESEND_API_KEY"
            description="Your Resend API key. Used by send-email to deliver transactional emails via Resend."
            required
            docsUrl="https://resend.com/api-keys"
          />
          <ConfigRow
            icon={Mail}
            name="STAYLINK_FROM_EMAIL"
            description='From address for all outbound emails. Format: "StayLink SVG <hello@yourdomain.com>". Falls back to onboarding@resend.dev if unset.'
            required
          />
          <ConfigRow
            icon={Mail}
            name="ADMIN_NOTIFICATION_EMAIL"
            description="Email address that receives admin notifications (new partner applications, system alerts). Used when to = 'admin' in send-email."
            required
          />
          <ConfigRow
            icon={Globe}
            name="SITE_URL"
            description="Public URL of the deployed app (e.g. https://staylinksvg.com). Used to build partner portal links in approval emails."
            required
          />
          <ConfigRow
            icon={Database}
            name="SUPABASE_URL"
            description="Your project's Supabase URL. Auto-injected by Supabase into all edge functions — no manual setup needed."
          />
          <ConfigRow
            icon={Database}
            name="SUPABASE_ANON_KEY"
            description="Public anon key. Auto-injected. Used for user JWT verification inside edge functions."
          />
          <ConfigRow
            icon={ShieldCheck}
            name="SUPABASE_SERVICE_ROLE_KEY"
            description="Service role key with full DB access. Auto-injected. Used by approve-partner and send-email for privileged operations."
          />
        </div>
      </section>

      {/* Edge functions reference */}
      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="font-display text-xl">Edge functions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Supabase Edge Functions deployed in supabase/functions/.
          </p>
        </div>
        <div className="divide-y text-sm">
          {[
            {
              name: "approve-partner",
              trigger: "Admin click → Partners page",
              desc: "Invites the partner via Supabase Auth, links their user_id, sets status=active, sends branded Resend welcome email.",
            },
            {
              name: "send-email",
              trigger: "Internal (approve-partner, UI via sendEmail())",
              desc: "Resend wrapper. Accepts admin JWT or service role key as Bearer. Routes to= 'admin' to ADMIN_NOTIFICATION_EMAIL.",
            },
            {
              name: "notify-onboarding",
              trigger: "Partner onboarding form submit",
              desc: "Sends admin new-partner alert email and partner onboarding welcome email.",
            },
            {
              name: "match-rooms",
              trigger: "Admin click → Redirects → Match",
              desc: "Scores available rooms against traveller requirements (type, budget, guests, dates). Returns primary and partial matches.",
            },
          ].map((fn) => (
            <div key={fn.name} className="px-5 py-4 grid grid-cols-[180px_1fr] gap-4">
              <div className="font-mono text-xs bg-muted rounded-md px-2 py-1 self-start">
                {fn.name}
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">
                  Trigger: {fn.trigger}
                </div>
                <div className="text-sm">{fn.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Admin accounts */}
      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 className="font-display text-xl">Admin accounts</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Users with the admin role. Manage via Supabase Table Editor → user_roles.
            </p>
          </div>
        </div>
        {admins.isLoading ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (admins.data?.length ?? 0) === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">
            No admin users found.
          </div>
        ) : (
          <div className="divide-y text-sm">
            {admins.data?.map((u) => (
              <div key={u.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="font-mono text-xs text-muted-foreground truncate">{u.user_id}</div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge variant="outline" className="capitalize bg-mint/20 text-primary border-mint/40">
                    {u.role}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Since {new Date(u.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-5 py-3 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground">
            To add an admin: insert a row in <code className="font-mono bg-muted px-1 rounded">user_roles</code> with{" "}
            <code className="font-mono bg-muted px-1 rounded">role = 'admin'</code> and the target{" "}
            <code className="font-mono bg-muted px-1 rounded">user_id</code>.
          </p>
        </div>
      </section>

      {/* Useful links */}
      <section className="rounded-2xl border bg-card">
        <div className="px-5 py-4 border-b">
          <h2 className="font-display text-xl">Useful links</h2>
        </div>
        <div className="divide-y text-sm">
          {[
            { label: "Supabase Dashboard", url: "https://supabase.com/dashboard" },
            { label: "Resend Dashboard", url: "https://resend.com/emails" },
            { label: "GitHub Repository", url: "https://github.com/Txnny/staylink-svg-connect" },
          ].map(({ label, url }) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
            >
              <span>{label}</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl">{value}</div>
    </div>
  );
}

function ConfigRow({
  icon: Icon,
  name,
  description,
  required,
  docsUrl,
}: {
  icon: typeof Key;
  name: string;
  description: string;
  required?: boolean;
  docsUrl?: string;
}) {
  return (
    <div className="px-5 py-4 grid grid-cols-[220px_1fr] gap-4 items-start">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div>
          <code className="text-xs font-mono">{name}</code>
          {required && (
            <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 h-4 border-amber/40 text-amber-foreground bg-amber/10">
              required
            </Badge>
          )}
        </div>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed">
        {description}
        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-0.5 text-primary hover:underline text-xs"
          >
            Docs <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
