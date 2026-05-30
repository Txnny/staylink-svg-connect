// Supabase Edge Function: send-email
// Transactional email sender. Wraps the Resend HTTP API.
// Requires a valid admin JWT OR the service role key (for internal function-to-function calls).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SendEmailInput {
  to: string | string[] | "admin";
  subject: string;
  html: string;
  reply_to?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }

    const token = authHeader.slice(7);

    // Allow internal service-role calls (e.g. from approve-partner) to bypass the
    // has_role check — the service role key is only known to edge functions.
    const isServiceRole = token === SERVICE_ROLE_KEY;

    if (!isServiceRole) {
      // Require admin JWT for external callers
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
      const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
        _user_id: userData.user.id,
        _role: "admin",
      });
      if (roleErr || !isAdmin) return json({ error: "Admin role required" }, 403);
    }

    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("STAYLINK_FROM_EMAIL") ?? "StayLink SVG <onboarding@resend.dev>";
    if (!apiKey) return json({ error: "RESEND_API_KEY not configured" }, 500);

    const body = (await req.json()) as SendEmailInput;
    if (!body?.to || !body?.subject || !body?.html) {
      return json({ error: "Missing required fields: to, subject, html" }, 400);
    }

    let recipients: string[];
    if (body.to === "admin") {
      const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
      if (!adminEmail) return json({ error: "ADMIN_NOTIFICATION_EMAIL not configured" }, 500);
      recipients = [adminEmail];
    } else {
      recipients = Array.isArray(body.to) ? body.to : [body.to];
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: body.subject,
        html: body.html,
        reply_to: body.reply_to,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Resend error", res.status, data);
      return json({ error: "Resend send failed", status: res.status, details: data }, 502);
    }
    return json({ ok: true, id: data.id ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("send-email error:", message);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
