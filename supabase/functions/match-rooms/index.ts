// Supabase Edge Function: match-rooms
// Scores available rooms against a traveller request and returns ranked matches.
// Runs server-side so scoring logic is never exposed to the browser.

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

interface ScoredMatch {
  room_id: string;
  property_id: string;
  property_name: string;
  property_type: string;
  location: string | null;
  room_name: string;
  price_per_night_xcd: number;
  max_guests: number;
  property_contact_email: string | null;
  booking_url: string;
  score: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as MatchInput;
    if (
      !body?.check_in ||
      !body?.check_out ||
      !body?.guest_count ||
      body?.budget_max_xcd == null
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const baseQuery = supabase
      .from("rooms")
      .select(
        `id, name, room_type, price_per_night_xcd, max_guests, available,
         available_from, available_to,
         property:properties(id, name, type, location, parish, contact_email, website)`,
      )
      .eq("available", true)
      .gte("max_guests", body.guest_count)
      .lte("price_per_night_xcd", body.budget_max_xcd);

    const { data, error } = await baseQuery;
    if (error) throw error;

    const rows = (data ?? []) as unknown as RoomRow[];

    // Date availability filter (rooms with null bounds treated as always-on)
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

    const toResult = (r: RoomRow): ScoredMatch => ({
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

    return new Response(
      JSON.stringify({ primary_matches, partial_matches }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
