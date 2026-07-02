// Run after applying the Session 2 migrations and inserting one test hostel
// (see supabase/SESSION_2_APPLY.md for both steps). Uses the anon key only —
// exactly what an unauthenticated browser sees — to prove RLS is doing its
// job, not just that the tables exist.
//
// Usage: node scripts/verify-schema.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  try {
    const content = readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) process.env[match[1]] ??= match[2].trim();
    }
  } catch {
    // .env.local not found; rely on real env vars.
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

let failures = 0;

function report(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures++;
}

// 1. Public SELECT on hostels must succeed and return rows (proves public read RLS).
const { data: hostels, error: selectError } = await supabase
  .from("hostels")
  .select("id, name, availability, rating_avg, rating_count")
  .limit(5);

report(
  "anon can SELECT hostels",
  !selectError && Array.isArray(hostels),
  selectError ? selectError.message : `${hostels?.length ?? 0} row(s)`
);
if (!hostels || hostels.length === 0) {
  console.log(
    "  (0 rows — insert a test hostel via the SQL editor first; see supabase/SESSION_2_APPLY.md)"
  );
}

// 2. Anon INSERT on hostels must be denied (admin-only policy).
const { error: insertError } = await supabase.from("hostels").insert({
  name: "RLS probe — should be rejected",
  price: 1,
  location: "test",
  contact: "test",
});
report(
  "anon INSERT into hostels is denied",
  !!insertError,
  insertError ? insertError.message : "insert unexpectedly succeeded"
);

// 3. Anon UPDATE on an existing hostel must be denied (owner/admin only).
if (hostels && hostels.length > 0) {
  const { error: updateError, data: updateData } = await supabase
    .from("hostels")
    .update({ name: "RLS probe — should not apply" })
    .eq("id", hostels[0].id)
    .select();
  const denied = !!updateError || (updateData ?? []).length === 0;
  report(
    "anon UPDATE on a hostel is denied",
    denied,
    updateError ? updateError.message : "0 rows affected (RLS filtered it)"
  );
}

// 4. Anon INSERT into reviews without auth must be denied (author_id = auth.uid()).
if (hostels && hostels.length > 0) {
  const { error: reviewError } = await supabase.from("reviews").insert({
    hostel_id: hostels[0].id,
    author_id: "00000000-0000-0000-0000-000000000000",
    rating: 5,
    comment: "RLS probe review — should be rejected",
  });
  report(
    "anon INSERT into reviews is denied",
    !!reviewError,
    reviewError ? reviewError.message : "insert unexpectedly succeeded"
  );
}

// 5. Anon SELECT on saved_hostels must return zero rows (owner-only policy,
// auth.uid() is null for anon so every row is filtered out).
const { data: saved, error: savedError } = await supabase.from("saved_hostels").select("id");
report(
  "anon SELECT on saved_hostels returns nothing",
  !savedError && (saved ?? []).length === 0,
  savedError ? savedError.message : `${saved?.length ?? 0} row(s)`
);

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
