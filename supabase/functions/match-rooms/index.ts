// Supabase Edge Function: match-rooms
// Admin-only. Scores available rooms against a traveller request and returns
// ranked matches. Requires a valid admin JWT.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface MatchInput {
  check_in: string;
  check_out: string;
  guest_count: number;
  budget_max_xcd: number;
  type_preference?: string | null;
}

interface RoomRow {
  id: string;
  name: string;
  room_type: string | null;
  price_per_night_xcd: number;
  max_guests: number;
  available: boolean;
  available_from: string | null;
  available_to: string | null;
  property: {
    id: string;
    name: string;
    type: string;
    location: string | null;
    parish: string | null;
    contact_email: string | null;
    website: string | null;
    rating?: number | null;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Admin-only
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing Authorization header" }, 401);
    }
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

    const body = (await req.json()) as MatchInput;
    if (!body?.check_in || !body?.check_out || !body?.guest_count || body?.budget_max_xcd == null) {
      return json({ error: "Missing required fields" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase
      .from("rooms")
      .select(
        `id, name, room_type, price_per_night_xcd, max_guests, available,
         available_from, available_to,
         property:properties(id, name, type, location, parish, contact_email, website, rating)`,
      )
      .eq("available", true)
      .gte("max_guests", body.guest_count)
      .lte("price_per_night_xcd", body.budget_max_xcd);
    if (error) throw error;

    const rows = (data ?? []) as unknown as RoomRow[];
    const fits = rows.filter((r) => {
      const fromOk = !r.available_from || r.available_from <= body.check_in;
      const toOk = !r.available_to || r.available_to >= body.check_out;
      return fromOk && toOk && r.property;
    });

    const pref = (body.type_preference ?? "").toLowerCase();
    const score = (r: RoomRow): number => {
      let s = 0;
      if (pref && pref !== "any" && r.property?.type?.toLowerCase() === pref) s += 3;
      if (r.price_per_night_xcd <= body.budget_max_xcd * 0.75) s += 2;
      const rating = r.property?.rating ?? null;
      if (rating != null && rating >= 4.0) s += 1;
      return s;
    };

    const toResult = (r: RoomRow) => ({
      room_id: r.id,
      property_id: r.property!.id,
      property_name: r.property!.name,
      property_type: r.property!.type,
      location: r.property!.location ?? r.property!.parish ?? null,
      room_name: r.name,
      price_per_night_xcd: Number(r.price_per_night_xcd),
      max_guests: r.max_guests,
      property_contact_email: r.property!.contact_email,
      booking_url: r.property!.website ?? "",
      score: score(r),
    });

    const ranked = [...fits].sort((a, b) => score(b) - score(a));
    const primary_matches = ranked
      .filter((r) => !pref || pref === "any" || r.property?.type?.toLowerCase() === pref)
      .slice(0, 3)
      .map(toResult);
    const primaryIds = new Set(primary_matches.map((m) => m.room_id));
    const partial_matches = ranked
      .filter((r) => !primaryIds.has(r.id))
      .slice(0, 3)
      .map(toResult);

    return json({ primary_matches, partial_matches });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
