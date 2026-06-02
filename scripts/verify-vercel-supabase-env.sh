#!/usr/bin/env bash
# Compare local .env Supabase vars with Vercel Production (requires: vercel login, vercel link).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env in project root" >&2
  exit 1
fi

PULL_FILE=".env.vercel.production.check"
rm -f "$PULL_FILE"
vercel env pull "$PULL_FILE" --environment=production --yes

node <<'NODE'
const fs = require("fs");
const path = require("path");

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

function fingerprint(name, value) {
  if (!value) return { name, set: false };
  let role = "?";
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString());
    role = payload.role ?? "?";
  } catch {}
  return {
    name,
    set: true,
    length: value.length,
    role,
    prefix: value.slice(0, 12),
    suffix: value.slice(-8),
  };
}

const local = loadEnv(path.join(process.cwd(), ".env"));
const vercel = loadEnv(path.join(process.cwd(), ".env.vercel.production.check"));

const keys = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
];

console.log("\n=== Supabase env comparison (Production) ===\n");
let ok = true;
for (const k of keys) {
  const l = local[k] ?? local[k.replace("VITE_", "")];
  const v = vercel[k];
  const fl = fingerprint(k + " (local .env)", l);
  const fv = fingerprint(k + " (Vercel)", v);
  console.log(JSON.stringify(fl, null, 2));
  console.log(JSON.stringify(fv, null, 2));
  const match = l && v && l === v;
  console.log(match ? "  ✓ values match\n" : "  ✗ MISMATCH or missing — fix Vercel Production env, then redeploy\n");
  if (!match) ok = false;
}

if (vercel.VITE_SUPABASE_PUBLISHABLE_KEY) {
  try {
    const role = JSON.parse(
      Buffer.from(vercel.VITE_SUPABASE_PUBLISHABLE_KEY.split(".")[1], "base64url").toString(),
    ).role;
    if (role !== "anon") {
      console.log(`⚠ VITE_SUPABASE_PUBLISHABLE_KEY role is "${role}" — must be anon (publishable) key\n`);
      ok = false;
    }
  } catch {}
}

console.log(ok ? "All checks passed. Redeploy Production if you changed any VITE_* values." : "Fix mismatches above, then: Vercel → Deployments → Redeploy (Production).");
process.exit(ok ? 0 : 1);
NODE
