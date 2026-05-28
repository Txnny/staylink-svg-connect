// Supabase Edge Function: notify-onboarding
// Public endpoint called right after a partner submits the onboarding form.
// Takes only { partner_id }, looks up the row server-side, and sends two
// fixed-template emails (welcome to the partner, notice to the admin).
// This avoids exposing send-email's arbitrary-HTML surface to anonymous users.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BRAND_HEAD = `
  <div style="background:#1D4E3A;padding:20px 24px;color:#ffffff;border-radius:12px 12px 0 0;">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:600;">StayLink SVG</div>
    <div style="font-size:12px;letter-spacing:0.15em;text-transform:uppercase;opacity:0.85;margin-top:2px;">St. Vincent &amp; the Grenadines</div>
  </div>`;
const BRAND_FOOT = `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888;">
    StayLink SVG — connecting travellers with the right room.
  </div>`;

function wrap(inner: string) {
  return `<div style="background:#f7f5f1;padding:28px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#1c1c1c;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      ${BRAND_HEAD}
      <div style="padding:24px;line-height:1.55;font-size:15px;">${inner}${BRAND_FOOT}</div>
    </div></div>`;
}
function esc(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("STAYLINK_FROM_EMAIL") ?? "StayLink SVG <onboarding@resend.dev>";
    const adminEmail = Deno.env.get("ADMIN_NOTIFICATION_EMAIL");
    if (!apiKey || !adminEmail) return json({ error: "Email not configured" }, 500);

    const { partner_id } = (await req.json()) as { partner_id?: string };
    if (!partner_id || typeof partner_id !== "string") {
      return json({ error: "partner_id required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: p, error } = await admin
      .from("partners")
      .select("id, business_name, contact_name, email, phone, parish, status")
      .eq("id", partner_id)
      .maybeSingle();
    if (error || !p) return json({ error: "Partner not found" }, 404);
    if (p.status !== "onboarding") return json({ error: "Already processed" }, 400);

    const welcomeHtml = wrap(`
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;">Welcome aboard, ${esc(p.contact_name)}.</h2>
      <p>Thanks for applying to list <strong>${esc(p.business_name)}</strong> with StayLink SVG.</p>
      <p>Our team will review your details and send portal access within <strong>24 hours</strong>.</p>
      <p style="margin-top:20px;">— The StayLink SVG team</p>`);
    const adminHtml = wrap(`
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:20px;">New partner application</h2>
      <table style="width:100%;font-size:14px;">
        <tr><td style="color:#666;padding:4px 0;">Business</td><td><strong>${esc(p.business_name)}</strong></td></tr>
        <tr><td style="color:#666;padding:4px 0;">Contact</td><td>${esc(p.contact_name)}</td></tr>
        <tr><td style="color:#666;padding:4px 0;">Parish</td><td>${esc(p.parish ?? "—")}</td></tr>
        <tr><td style="color:#666;padding:4px 0;">Email</td><td>${esc(p.email)}</td></tr>
        <tr><td style="color:#666;padding:4px 0;">Phone</td><td>${esc(p.phone ?? "—")}</td></tr>
      </table>`);

    async function send(to: string, subject: string, html: string) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      if (!res.ok) console.error("Resend failed", res.status, await res.text().catch(() => ""));
    }

    await Promise.all([
      send(p.email, "Welcome to StayLink SVG — your application is received", welcomeHtml),
      send(adminEmail, `New partner application — ${p.business_name}`, adminHtml),
    ]);

    return json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("notify-onboarding error:", message);
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
