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
      .select("id, email, business_name, contact_name, user_id, status")
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
