// Supabase Edge Function: approve-partner
// Admin-only: invites a partner via Supabase Auth and links the new auth user
// to the partner row. Uses the service role key so the key is never exposed
// to the browser. Caller must be authenticated AND have role = 'admin'.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ApprovePartnerInput {
  partner_id: string;
  redirect_to?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SITE_URL = Deno.env.get("SITE_URL") ?? "";

    // 1. Authenticate the caller and check admin role using their JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      return json({ error: "Admin role required" }, 403);
    }

    // 2. Read partner row
    const body = (await req.json()) as ApprovePartnerInput;
    if (!body?.partner_id) return json({ error: "partner_id required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: partner, error: pErr } = await admin
      .from("partners")
      .select("id, email, business_name, contact_name, user_id, status, fee_agreement_type, fee_rate, parish")
      .eq("id", body.partner_id)
      .maybeSingle();
    if (pErr || !partner) return json({ error: "Partner not found" }, 404);
    if (partner.user_id) return json({ error: "Partner already linked to an auth user" }, 400);

    // 3. Invite the partner — Supabase sends a magic-link invite email
    const redirectTo = body.redirect_to ?? `${new URL(req.url).origin.replace(/\/functions.*/, "")}/partner/login`;
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      partner.email,
      {
        redirectTo,
        data: {
          partner_id: partner.id,
          business_name: partner.business_name,
        },
      },
    );

    let authUserId: string | null = invited?.user?.id ?? null;

    // Handle case where the auth user already exists — look them up
    if (inviteErr) {
      const msg = (inviteErr.message ?? "").toLowerCase();
      const exists = msg.includes("already") || msg.includes("registered") || msg.includes("exists");
      if (!exists) {
        console.error("inviteUserByEmail error", inviteErr);
        return json({ error: inviteErr.message }, 500);
      }
      // List users and find by email
      const { data: list } = await admin.auth.admin.listUsers();
      const match = list?.users?.find((u) => u.email?.toLowerCase() === partner.email.toLowerCase());
      authUserId = match?.id ?? null;
      if (!authUserId) return json({ error: "Could not resolve existing auth user" }, 500);
    }

    if (!authUserId) return json({ error: "No auth user id returned" }, 500);

    // 4. Link auth user to partner and mark active
    const { error: updErr } = await admin
      .from("partners")
      .update({ user_id: authUserId, status: "active" })
      .eq("id", partner.id);
    if (updErr) return json({ error: updErr.message }, 500);

    // 5. Send branded welcome email via send-email function (non-blocking)
    try {
      const feeLabel =
        partner.fee_agreement_type === "flat"
          ? `Flat EC$${partner.fee_rate} per booking`
          : `${partner.fee_rate}% of each booking total`;

      const portalUrl = `${SITE_URL}/partner/login`;

      const welcomeHtml = buildWelcomeEmail({
        contactName: partner.contact_name,
        businessName: partner.business_name,
        parish: partner.parish ?? "",
        feeLabel,
        portalUrl,
        loginEmail: partner.email,
      });

      const emailRes = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          to: partner.email,
          subject: "You're approved — welcome to StayLink SVG",
          html: welcomeHtml,
        }),
      });

      if (!emailRes.ok) {
        const detail = await emailRes.json().catch(() => ({}));
        console.error("Welcome email failed (non-blocking):", detail);
      }
    } catch (emailErr) {
      console.error("Welcome email threw (non-blocking):", emailErr);
    }

    return json({ ok: true, user_id: authUserId, partner_id: partner.id, email: partner.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("approve-partner error:", message);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWelcomeEmail(p: {
  contactName: string;
  businessName: string;
  parish: string;
  feeLabel: string;
  portalUrl: string;
  loginEmail: string;
}): string {
  const inner = `
    <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;">
      You're in, ${escapeHtml(p.contactName)}.
    </h2>
    <p>Welcome to the <strong>StayLink SVG partner network</strong>.</p>
    <p>
      Your property <strong>${escapeHtml(p.businessName)}</strong>
      ${p.parish ? `in <strong>${escapeHtml(p.parish)}</strong>` : ""}
      is now live on the platform.
    </p>
    <p>
      When we redirect a traveller to your property you'll receive an email with their
      details, check-in date, and a fee preview — so you always know what's coming.
    </p>
    <table style="width:100%;font-size:14px;border-collapse:collapse;margin:16px 0;">
      <tr>
        <td style="padding:4px 0;color:#666;">Your fee agreement</td>
        <td><strong>${escapeHtml(p.feeLabel)}</strong></td>
      </tr>
      <tr>
        <td style="padding:4px 0;color:#666;">Your login email</td>
        <td>${escapeHtml(p.loginEmail)}</td>
      </tr>
    </table>
    <p>
      <a href="${p.portalUrl}"
         style="background:#1D4E3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;">
        Access your partner portal
      </a>
    </p>
    <p style="font-size:13px;color:#666;margin-top:8px;">
      On your first visit, use "Forgot password" to set your password — your account is
      ready, you just need to create a password to sign in.
    </p>
    <p style="margin-top:20px;">— Anton &amp; the StayLink SVG team</p>
  `;

  const BRAND_HEAD = `
    <div style="background:#1D4E3A;padding:20px 24px;color:#ffffff;border-radius:12px 12px 0 0;">
      <div style="font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:0.2px;">StayLink SVG</div>
      <div style="font-size:12px;letter-spacing:0.15em;text-transform:uppercase;opacity:0.85;margin-top:2px;">St. Vincent &amp; the Grenadines</div>
    </div>`;

  const BRAND_FOOT = `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888;">
      StayLink SVG — connecting travellers with the right room.
    </div>`;

  return `
  <div style="background:#f7f5f1;padding:28px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1c1c1c;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
      ${BRAND_HEAD}
      <div style="padding:24px;line-height:1.55;font-size:15px;">
        ${inner}
        ${BRAND_FOOT}
      </div>
    </div>
  </div>`;
}
