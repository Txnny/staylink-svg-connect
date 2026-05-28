import { supabase } from "@/integrations/supabase/client";

export const PARISHES = [
  "Kingstown",
  "Calliaqua",
  "Marriaqua",
  "Sandy Bay",
  "Barrouallie",
  "Chateaubelair",
  "Georgetown",
  "Bequia",
  "Mustique",
  "Union Island",
  "Other",
] as const;

const BRAND_HEAD = `
  <div style="background:#1D4E3A;padding:20px 24px;color:#ffffff;border-radius:12px 12px 0 0;">
    <div style="font-family:Georgia,serif;font-size:22px;font-weight:600;letter-spacing:0.2px;">StayLink SVG</div>
    <div style="font-size:12px;letter-spacing:0.15em;text-transform:uppercase;opacity:0.85;margin-top:2px;">St. Vincent &amp; the Grenadines</div>
  </div>`;

const BRAND_FOOT = `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888;">
    StayLink SVG — connecting travellers with the right room.
  </div>`;

function wrap(inner: string): string {
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

export async function sendEmail(args: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("send-email", { body: args });
    if (error) console.error("sendEmail error", error);
  } catch (e) {
    console.error("sendEmail threw", e);
  }
}

export const templates = {
  partnerOnboardingWelcome(p: { businessName: string; contactName: string }) {
    return wrap(`
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;">Welcome aboard, ${escapeHtml(p.contactName)}.</h2>
      <p>Thanks for applying to list <strong>${escapeHtml(p.businessName)}</strong> with StayLink SVG.</p>
      <p>Our team will review your details and send portal access within <strong>24 hours</strong>. You'll receive a separate email with a sign-in link as soon as your account is activated.</p>
      <p>If anything changes in the meantime, just reply to this email.</p>
      <p style="margin-top:20px;">— The StayLink SVG team</p>
    `);
  },
  adminNewPartnerNotice(p: {
    businessName: string;
    contactName: string;
    propertyType: string;
    parish: string;
    email: string;
    phone: string;
    adminUrl: string;
  }) {
    return wrap(`
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:20px;">New partner application</h2>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:#666;">Business</td><td><strong>${escapeHtml(p.businessName)}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#666;">Contact</td><td>${escapeHtml(p.contactName)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Type</td><td>${escapeHtml(p.propertyType)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Parish</td><td>${escapeHtml(p.parish)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Email</td><td>${escapeHtml(p.email)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Phone</td><td>${escapeHtml(p.phone)}</td></tr>
      </table>
      <p style="margin-top:20px;">
        <a href="${p.adminUrl}" style="background:#1D4E3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;">Review in admin</a>
      </p>
    `);
  },
  travellerBookingConfirmed(p: {
    travellerName: string;
    propertyName: string;
    address: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    nightlyRate: string;
    total: string;
    contact: string;
    bookingUrl?: string | null;
  }) {
    return wrap(`
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;">You're booked, ${escapeHtml(p.travellerName)}.</h2>
      <p>We've secured your stay at <strong>${escapeHtml(p.propertyName)}</strong>.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:4px 0;color:#666;">Address</td><td>${escapeHtml(p.address)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Check-in</td><td>${escapeHtml(p.checkIn)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Check-out</td><td>${escapeHtml(p.checkOut)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Nights</td><td>${p.nights}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Nightly rate</td><td>${escapeHtml(p.nightlyRate)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Total</td><td><strong>${escapeHtml(p.total)}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#666;">Property contact</td><td>${escapeHtml(p.contact)}</td></tr>
      </table>
      ${p.bookingUrl ? `<p><a href="${p.bookingUrl}" style="background:#1D4E3A;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block;">View property</a></p>` : ""}
      <p style="margin-top:20px;">Safe travels — the StayLink SVG team.</p>
    `);
  },
  partnerBookingConfirmed(p: {
    travellerName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    roomName: string;
    total: string;
    finderFee: string;
  }) {
    return wrap(`
      <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:22px;">New redirect booking confirmed.</h2>
      <p><strong>${escapeHtml(p.travellerName)}</strong> is confirmed for <strong>${escapeHtml(p.roomName)}</strong>.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin:12px 0;">
        <tr><td style="padding:4px 0;color:#666;">Check-in</td><td>${escapeHtml(p.checkIn)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Check-out</td><td>${escapeHtml(p.checkOut)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Nights</td><td>${p.nights}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Booking value</td><td>${escapeHtml(p.total)}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Finder's fee (invoiced)</td><td><strong>${escapeHtml(p.finderFee)}</strong></td></tr>
      </table>
      <p style="margin-top:20px;">— The StayLink SVG team</p>
    `);
  },
};

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
