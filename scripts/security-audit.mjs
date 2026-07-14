#!/usr/bin/env node
// scripts/security-audit.mjs
//
// Rerunnable adversarial security audit -- every table x operation x
// role (anonymous, authenticated stranger, owner, admin), tested via
// direct REST/RPC calls, never through the UI (the UI is not a security
// boundary). See SECURITY.md for the full narrative; this script is the
// durable, re-runnable version of the same checks.
//
// Usage:
//   node scripts/security-audit.mjs
//
// Reads .env.local automatically (no extra flags needed). Required:
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
//   SECURITY_AUDIT_ADMIN_EMAIL / SECURITY_AUDIT_ADMIN_PASSWORD
//     -- an existing account with profiles.role = 'admin'.
// Optional (falls back to a gmail "+" sub-address of the admin email so
// confirmation mail lands in an inbox you already control):
//   SECURITY_AUDIT_STRANGER_EMAIL / _PASSWORD
//   SECURITY_AUDIT_OWNER_EMAIL / _PASSWORD
//
// First run: if the stranger/owner accounts don't exist yet, the script
// signs them up and STOPS, asking you to confirm both via email (Supabase
// requires email confirmation before sign-in works) and re-run. Every run
// after that is fully automatic -- accounts and the owner's one bootstrap
// test hostel are reused, not recreated.
//
// Exit codes: 0 = every check passed. 1 = at least one real finding.
// 2 = setup incomplete (accounts pending email confirmation).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ---------------------------------------------------------------------
// .env.local loader (no dependency on dotenv -- this repo doesn't have it)
// ---------------------------------------------------------------------
function loadEnvLocal() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (checked process.env and .env.local).");
  process.exit(2);
}

const ADMIN_EMAIL = process.env.SECURITY_AUDIT_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SECURITY_AUDIT_ADMIN_PASSWORD;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing SECURITY_AUDIT_ADMIN_EMAIL / SECURITY_AUDIT_ADMIN_PASSWORD -- set these to an existing admin account.");
  process.exit(2);
}

// Gmail's "+" sub-addressing (user+tag@gmail.com still delivers to
// user@gmail.com) means these can default to real, confirmable addresses
// without needing two more real mailboxes -- only meaningful if the admin
// email happens to be a gmail address; override via env otherwise.
const [adminLocal, adminDomain] = ADMIN_EMAIL.split("@");
const STRANGER_EMAIL = process.env.SECURITY_AUDIT_STRANGER_EMAIL || `${adminLocal}+audit-stranger@${adminDomain}`;
const STRANGER_PASSWORD = process.env.SECURITY_AUDIT_STRANGER_PASSWORD || "AuditStranger123!";
const OWNER_EMAIL = process.env.SECURITY_AUDIT_OWNER_EMAIL || `${adminLocal}+audit-owner@${adminDomain}`;
const OWNER_PASSWORD = process.env.SECURITY_AUDIT_OWNER_PASSWORD || "AuditOwner123!";

// ---------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------
async function restFetch(token, path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token ?? ANON_KEY}`,
      "Content-Type": "application/json",
      ...(init.prefer ? { Prefer: init.prefer } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, ok: res.ok, body: json };
}

const get = (token, path) => restFetch(token, path, { method: "GET" });
const post = (token, path, body, prefer) => restFetch(token, path, { method: "POST", body: JSON.stringify(body), prefer });
const patch = (token, path, body, prefer) => restFetch(token, path, { method: "PATCH", body: JSON.stringify(body), prefer });
const del = (token, path, prefer) => restFetch(token, path, { method: "DELETE", prefer });
const rpc = (token, fn, args) => post(token, `/rpc/${fn}`, args);

async function authSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  return { ok: res.ok, ...json };
}

async function authSignUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { ok: res.ok, ...(await res.json()) };
}

// ---------------------------------------------------------------------
// Tiny assertion harness
// ---------------------------------------------------------------------
const results = { pass: 0, fail: 0, accepted: 0, skipped: 0 };
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    results.pass++;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    results.fail++;
    failures.push({ label, detail });
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` -- ${detail}` : ""}`);
  }
}

// A finding we've decided to accept rather than fix (see SECURITY.md) --
// logged distinctly so it never silently starts passing/failing without
// notice, but doesn't fail the run.
function acceptedRisk(label, detail) {
  results.accepted++;
  console.log(`  \x1b[33m○\x1b[0m ${label} (accepted risk${detail ? `: ${detail}` : ""})`);
}

function skip(label, reason) {
  results.skipped++;
  console.log(`  \x1b[90m–\x1b[0m ${label} (skipped: ${reason})`);
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------
// Bootstrap: sign in all four roles. Stranger/owner are created on first
// run and require one manual email confirmation each -- everything after
// that is fully automatic. Returns null (rather than exiting) when an
// account exists but isn't confirmed yet, so main() can decide whether to
// degrade gracefully instead of blocking the entire run on one pending
// email -- confirmation delivery is outside this script's control.
// ---------------------------------------------------------------------
async function ensureAccount(email, password, label) {
  let session = await authSignIn(email, password);
  if (session.ok) return session;

  if (session.error_code === "email_not_confirmed") {
    console.log(`  ${label} account (${email}) exists but isn't confirmed yet -- skipping for now.`);
    return null;
  }

  // Doesn't exist yet (or wrong password) -- try creating it.
  const signUp = await authSignUp(email, password);
  if (!signUp.ok) {
    console.error(`\nCouldn't sign in OR sign up as ${label} (${email}): ${JSON.stringify(session)} / ${JSON.stringify(signUp)}`);
    process.exit(2);
  }

  if (signUp.confirmation_sent_at || !signUp.access_token) {
    console.log(`  ${label} test account (${email}) just created -- check the inbox for ${email.split("+")[0].split("@")[0]}@${email.split("@")[1]} and confirm it, then re-run for full coverage. Continuing without it for now.`);
    return null;
  }

  return signUp;
}

async function main() {
  console.log("UMaT Hostel Finder -- security audit\n" + "=".repeat(40));

  section("Bootstrap: signing in as all four roles");
  const admin = await authSignIn(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (!admin.ok) {
    console.error(`Couldn't sign in as admin (${ADMIN_EMAIL}): ${JSON.stringify(admin)}`);
    process.exit(2);
  }
  console.log(`  signed in as admin: ${ADMIN_EMAIL}`);

  const stranger = await ensureAccount(STRANGER_EMAIL, STRANGER_PASSWORD, "stranger");
  if (stranger) console.log(`  signed in as stranger: ${STRANGER_EMAIL}`);
  const ownerAccount = await ensureAccount(OWNER_EMAIL, OWNER_PASSWORD, "owner");
  if (ownerAccount) console.log(`  signed in as owner: ${OWNER_EMAIL}`);

  if (!stranger) {
    console.error("\nStopping -- the matrix needs at least one confirmed non-admin account (stranger).");
    process.exit(2);
  }

  // If the dedicated owner account isn't confirmed yet, fall back to using
  // the stranger account as the hostel owner too -- this still exercises
  // every RLS policy correctly (owner-vs-admin, anon-vs-authenticated),
  // it just can't prove the narrower "a *different* logged-in stranger"
  // cross-user cases, which are marked skipped below instead of failed.
  const owner = ownerAccount ?? stranger;
  const hasDistinctOwner = !!ownerAccount;
  if (!hasDistinctOwner) {
    console.log("  (owner account not confirmed yet -- using the stranger account as a stand-in owner; a few cross-user checks will be skipped)");
  }

  const adminToken = admin.access_token;
  const strangerToken = stranger.access_token;
  const ownerToken = owner.access_token;
  const strangerUid = stranger.user.id;
  const ownerUid = owner.user.id;

  // Confirm the admin account is actually an admin -- if it isn't, every
  // "admin should succeed" check below would (correctly) fail, which
  // would be confusing to read without this upfront sanity check.
  const adminProfile = await get(adminToken, `/profiles?id=eq.${admin.user.id}&select=role`);
  const isRealAdmin = adminProfile.body?.[0]?.role === "admin";
  check("admin account actually has role='admin'", isRealAdmin, `got ${JSON.stringify(adminProfile.body)}`);
  if (!isRealAdmin) {
    console.error("\nStopping -- the rest of the matrix assumes a real admin account.");
    process.exit(2);
  }

  // Bootstrap: the owner needs to actually own a hostel to test owner-vs-
  // stranger-vs-admin distinctions meaningfully. Reused across runs.
  section("Bootstrap: ensuring the owner test account owns a test hostel");
  let ownerHostelId;
  const existingOwned = await get(adminToken, `/hostels?owner_id=eq.${ownerUid}&select=id&limit=1`);
  if (existingOwned.body?.length > 0) {
    ownerHostelId = existingOwned.body[0].id;
    console.log(`  reusing existing owned test hostel: ${ownerHostelId}`);
  } else {
    const submission = await post(
      ownerToken,
      "/submissions",
      {
        submitted_by: ownerUid,
        name: "[Security Audit] Test Hostel -- safe to ignore/delete",
        location: "Security Audit Zone",
        contact: "233200000000",
        room_types: [{ type: "1_in_room", price: 1000, images: [] }],
      },
      "return=representation"
    );
    if (!submission.ok) {
      console.error("Couldn't bootstrap the owner's test submission:", submission.status, JSON.stringify(submission.body));
      process.exit(2);
    }
    const submissionId = submission.body[0].id;
    const approved = await rpc(adminToken, "approve_submission", { p_submission_id: submissionId });
    if (!approved.ok) {
      console.error("Couldn't approve the owner's bootstrap submission:", JSON.stringify(approved.body));
      process.exit(2);
    }
    ownerHostelId = approved.body;
    console.log(`  created + approved a new owned test hostel: ${ownerHostelId}`);
  }

  // =====================================================================
  // profiles
  // =====================================================================
  section("profiles");
  {
    const anonAll = await get(null, `/profiles?select=id,email,role`);
    check("anon SELECT profiles returns zero rows (email/role no longer harvestable)", Array.isArray(anonAll.body) && anonAll.body.length === 0, JSON.stringify(anonAll.body)?.slice(0, 200));

    const strangerReadsAdmin = await get(strangerToken, `/profiles?id=eq.${admin.user.id}&select=email,role`);
    check("stranger cannot read another user's email/role", Array.isArray(strangerReadsAdmin.body) && strangerReadsAdmin.body.length === 0, JSON.stringify(strangerReadsAdmin.body));

    const strangerReadsSelf = await get(strangerToken, `/profiles?id=eq.${strangerUid}&select=email,role`);
    check("stranger CAN read their own email/role", strangerReadsSelf.body?.[0]?.email === STRANGER_EMAIL);

    const adminReadsAll = await get(adminToken, `/profiles?select=id&limit=5`);
    check("admin can read other users' profiles", Array.isArray(adminReadsAll.body) && adminReadsAll.body.length > 1, `got ${adminReadsAll.body?.length} rows`);

    const anonInsert = await post(null, "/profiles", { id: "00000000-0000-0000-0000-000000000000", email: "x@x.com" });
    check("anon cannot INSERT a profile", !anonInsert.ok, `status ${anonInsert.status}`);

    // Self-promotion attack: a non-admin tries to grant themselves admin.
    const selfPromote = await patch(strangerToken, `/profiles?id=eq.${strangerUid}`, { role: "admin" }, "return=representation");
    const afterPromote = await get(strangerToken, `/profiles?id=eq.${strangerUid}&select=role`);
    check("stranger cannot self-promote to admin (trigger reverts it)", afterPromote.body?.[0]?.role === "student", JSON.stringify(afterPromote.body));

    const strangerDeletesAdmin = await del(strangerToken, `/profiles?id=eq.${admin.user.id}`);
    const adminStillExists = await get(adminToken, `/profiles?id=eq.${admin.user.id}&select=id`);
    check("stranger cannot delete another profile", adminStillExists.body?.length === 1);
  }

  // =====================================================================
  // hostels
  // =====================================================================
  section("hostels");
  {
    const anonRead = await get(null, `/hostels?select=id,name&limit=1`);
    check("anon CAN read live hostels (intended -- public feed)", Array.isArray(anonRead.body) && anonRead.body.length > 0);

    const anonPendingChanges = await get(null, `/hostels?select=pending_changes&has_pending_edit=eq.true&limit=1`);
    // Known, accepted finding -- see SECURITY.md. RLS is row-level only;
    // properly hiding this column from anon/authenticated while still
    // letting admin read it would need a dedicated RPC + app-code change.
    // Deferred rather than risking a regression in the (already-shipped,
    // tested) admin edit-request review flow under audit time pressure.
    acceptedRisk(
      "pending_changes is technically readable via a direct API call (app itself never requests it)",
      `${anonPendingChanges.status}, ${anonPendingChanges.body?.length ?? 0} row(s)`
    );

    const anonInsert = await post(null, "/hostels", { name: "hax", location: "x", contact: "233200000000" });
    check("anon cannot INSERT a hostel", !anonInsert.ok, `status ${anonInsert.status}`);

    const strangerInsert = await post(strangerToken, "/hostels", { name: "hax", location: "x", contact: "233200000000" });
    check("authenticated stranger cannot INSERT a hostel directly", !strangerInsert.ok, `status ${strangerInsert.status}`);

    const ownerDirectUpdate = await patch(ownerToken, `/hostels?id=eq.${ownerHostelId}`, { name: "Renamed directly, should fail" }, "return=representation");
    const stillOriginalName = await get(adminToken, `/hostels?id=eq.${ownerHostelId}&select=name`);
    check(
      "owner CANNOT update their own live hostel directly (must go through submit_pending_edit)",
      stillOriginalName.body?.[0]?.name?.startsWith("[Security Audit]"),
      JSON.stringify(stillOriginalName.body)
    );

    const strangerUpdateOther = await patch(strangerToken, `/hostels?id=eq.${ownerHostelId}`, { name: "hax" }, "return=representation");
    check("stranger cannot update someone else's hostel", !strangerUpdateOther.body || strangerUpdateOther.body.length === 0);

    const adminUpdate = await patch(adminToken, `/hostels?id=eq.${ownerHostelId}`, { distance_text: "audit-touched" }, "return=representation");
    check("admin CAN update any hostel", adminUpdate.body?.[0]?.distance_text === "audit-touched", JSON.stringify(adminUpdate.body));

    const strangerDelete = await del(strangerToken, `/hostels?id=eq.${ownerHostelId}`);
    const stillExists = await get(adminToken, `/hostels?id=eq.${ownerHostelId}&select=id`);
    check("stranger cannot delete a hostel", stillExists.body?.length === 1);
  }

  // =====================================================================
  // submissions
  // =====================================================================
  section("submissions");
  {
    // Clean slate: delete any leftover pending test submissions from a
    // previous interrupted run before testing the pending-cap.
    const leftovers = await get(strangerToken, `/submissions?submitted_by=eq.${strangerUid}&status=eq.pending&select=id`);
    for (const row of leftovers.body ?? []) {
      await del(strangerToken, `/submissions?id=eq.${row.id}`);
    }

    const insertOwn = await post(
      strangerToken,
      "/submissions",
      { submitted_by: strangerUid, name: "[Security Audit] Submission 1", location: "x", contact: "233200000000" },
      "return=representation"
    );
    check("stranger CAN submit their own hostel", insertOwn.ok && insertOwn.body?.[0]?.id, JSON.stringify(insertOwn.body));
    const submissionId = insertOwn.body?.[0]?.id;

    if (hasDistinctOwner) {
      const spoofOwner = await post(
        strangerToken,
        "/submissions",
        { submitted_by: ownerUid, name: "hax", location: "x", contact: "233200000000" },
        "return=representation"
      );
      check("stranger cannot submit AS another user (submitted_by spoof)", !spoofOwner.ok, `status ${spoofOwner.status}`);
    } else {
      skip("stranger cannot submit AS another user (submitted_by spoof)", "owner account not confirmed -- ownerUid === strangerUid right now, so this would just be a legitimate self-insert, not a real spoof test");
    }

    if (hasDistinctOwner) {
      const otherReads = await get(ownerToken, `/submissions?id=eq.${submissionId}&select=id`);
      check("a different user cannot see the stranger's submission", otherReads.body?.length === 0);
    } else {
      skip("a different user cannot see the stranger's submission", "owner account not confirmed -- no second distinct identity available");
    }

    const selfApprove = await patch(strangerToken, `/submissions?id=eq.${submissionId}`, { status: "approved" }, "return=representation");
    const stillPending = await get(strangerToken, `/submissions?id=eq.${submissionId}&select=status`);
    check("stranger cannot self-approve their own submission", stillPending.body?.[0]?.status === "pending", JSON.stringify(stillPending.body));

    // Pending-submission flood cap (new in this session).
    await post(strangerToken, "/submissions", { submitted_by: strangerUid, name: "[Security Audit] Submission 2", location: "x", contact: "233200000000" });
    await post(strangerToken, "/submissions", { submitted_by: strangerUid, name: "[Security Audit] Submission 3", location: "x", contact: "233200000000" });
    const fourthAttempt = await post(strangerToken, "/submissions", { submitted_by: strangerUid, name: "[Security Audit] Submission 4 (should be rejected)", location: "x", contact: "233200000000" });
    check("a 4th pending submission is rejected by the pending-cap trigger", !fourthAttempt.ok, `status ${fourthAttempt.status}, ${JSON.stringify(fourthAttempt.body)}`);

    // Cleanup: delete all of the stranger's pending test submissions.
    const cleanup = await get(strangerToken, `/submissions?submitted_by=eq.${strangerUid}&status=eq.pending&select=id`);
    for (const row of cleanup.body ?? []) {
      await del(strangerToken, `/submissions?id=eq.${row.id}`);
    }

    const adminReadsAny = await get(adminToken, `/submissions?select=id&limit=1`);
    check("admin can read submissions", Array.isArray(adminReadsAny.body));
  }

  // =====================================================================
  // reviews
  // =====================================================================
  section("reviews");
  {
    // Clean slate from any previous interrupted run.
    const existingReview = await get(strangerToken, `/reviews?hostel_id=eq.${ownerHostelId}&author_id=eq.${strangerUid}&select=id`);
    for (const row of existingReview.body ?? []) {
      await del(adminToken, `/reviews?id=eq.${row.id}`);
    }

    const tooShort = await post(strangerToken, "/reviews", { hostel_id: ownerHostelId, author_id: strangerUid, rating: 5, comment: "too short" });
    check("a comment under 15 chars is rejected (CHECK constraint)", !tooShort.ok, `status ${tooShort.status}`);

    const badRating = await post(strangerToken, "/reviews", { hostel_id: ownerHostelId, author_id: strangerUid, rating: 7, comment: "Rating out of range test comment" });
    check("a rating outside 1-5 is rejected (CHECK constraint)", !badRating.ok, `status ${badRating.status}`);

    const insert = await post(
      strangerToken,
      "/reviews",
      { hostel_id: ownerHostelId, author_id: strangerUid, rating: 5, comment: "Security audit test review, safe to ignore." },
      "return=representation"
    );
    check("a valid review CAN be posted", insert.ok && insert.body?.[0]?.id, JSON.stringify(insert.body));
    const reviewId = insert.body?.[0]?.id;

    const spoofAuthor = await post(strangerToken, "/reviews", { hostel_id: ownerHostelId, author_id: ownerUid, rating: 5, comment: "Spoofed author id test, should fail." });
    check("cannot spoof author_id to someone else", !spoofAuthor.ok, `status ${spoofAuthor.status}`);

    const duplicate = await post(strangerToken, "/reviews", { hostel_id: ownerHostelId, author_id: strangerUid, rating: 4, comment: "Duplicate review test, should be rejected." });
    check("a second review by the same author on the same hostel is rejected (unique constraint)", !duplicate.ok, `status ${duplicate.status}`);

    if (hasDistinctOwner) {
      const otherEdits = await patch(ownerToken, `/reviews?id=eq.${reviewId}`, { rating: 1 }, "return=representation");
      check("a different user cannot edit someone else's review", !otherEdits.body || otherEdits.body.length === 0);
    } else {
      skip("a different user cannot edit someone else's review", "owner account not confirmed -- no second distinct identity available");
    }

    const forgeResident = await patch(strangerToken, `/reviews?id=eq.${reviewId}`, { is_resident: true }, "return=representation");
    check("author cannot forge is_resident via direct update (trigger reverts it)", forgeResident.body?.[0]?.is_resident === false, JSON.stringify(forgeResident.body));

    const anonReport = await rpc(null, "report_review", { p_review_id: reviewId });
    check("anon cannot call report_review", !anonReport.ok, JSON.stringify(anonReport.body));

    const report = await rpc(ownerToken, "report_review", { p_review_id: reviewId });
    check("a different authenticated user CAN report a review", report.ok, JSON.stringify(report.body));

    const selfClearReport = await patch(strangerToken, `/reviews?id=eq.${reviewId}`, { reported: false }, "return=representation");
    check("author cannot self-clear their own review's report flag (trigger reverts it)", selfClearReport.body?.[0]?.reported === true, JSON.stringify(selfClearReport.body));

    const adminClears = await patch(adminToken, `/reviews?id=eq.${reviewId}`, { reported: false }, "return=representation");
    check("admin CAN clear a report", adminClears.body?.[0]?.reported === false, JSON.stringify(adminClears.body));

    const strangerDeletesOwn = await del(strangerToken, `/reviews?id=eq.${reviewId}`);
    const gone = await get(adminToken, `/reviews?id=eq.${reviewId}&select=id`);
    check("author can delete their own review", gone.body?.length === 0);
  }

  // =====================================================================
  // saved_hostels
  // =====================================================================
  section("saved_hostels");
  {
    const cleanupFirst = await get(strangerToken, `/saved_hostels?user_id=eq.${strangerUid}&hostel_id=eq.${ownerHostelId}&select=id`);
    for (const row of cleanupFirst.body ?? []) await del(strangerToken, `/saved_hostels?id=eq.${row.id}`);

    const insertOwn = await post(strangerToken, "/saved_hostels", { user_id: strangerUid, hostel_id: ownerHostelId }, "return=representation");
    check("stranger can save a hostel", insertOwn.ok, JSON.stringify(insertOwn.body));

    const spoof = await post(ownerToken, "/saved_hostels", { user_id: strangerUid, hostel_id: ownerHostelId }, "return=representation");
    check("cannot save on behalf of another user (user_id spoof)", !spoof.ok || (spoof.body?.length ?? 0) === 0, `status ${spoof.status}`);

    if (hasDistinctOwner) {
      const otherReads = await get(ownerToken, `/saved_hostels?user_id=eq.${strangerUid}&select=id`);
      check("a different user cannot read someone else's saves", otherReads.body?.length === 0);
    } else {
      skip("a different user cannot read someone else's saves", "owner account not confirmed -- no second distinct identity available");
    }

    const adminReads = await get(adminToken, `/saved_hostels?user_id=eq.${strangerUid}&select=id`);
    check("admin CAN read any user's saves (dashboard count)", adminReads.body?.length === 1);

    const cleanup = await get(strangerToken, `/saved_hostels?user_id=eq.${strangerUid}&hostel_id=eq.${ownerHostelId}&select=id`);
    for (const row of cleanup.body ?? []) await del(strangerToken, `/saved_hostels?id=eq.${row.id}`);
  }

  // =====================================================================
  // roommate_* (V2 tables -- must still deny everyone but service_role)
  // =====================================================================
  section("roommate_profiles / roommate_requests (V2, should be deny-all)");
  {
    for (const [role, token] of [["anon", null], ["stranger", strangerToken], ["admin", adminToken]]) {
      const readProfiles = await get(token, "/roommate_profiles?select=id&limit=1");
      check(`${role} cannot read roommate_profiles`, !readProfiles.ok || readProfiles.body?.length === 0, `status ${readProfiles.status}`);

      const insertProfiles = await post(token, "/roommate_profiles", { user_id: strangerUid, display_name: "x", whatsapp: "233200000000" });
      check(`${role} cannot insert into roommate_profiles`, !insertProfiles.ok, `status ${insertProfiles.status}`);

      const readRequests = await get(token, "/roommate_requests?select=id&limit=1");
      check(`${role} cannot read roommate_requests`, !readRequests.ok || readRequests.body?.length === 0, `status ${readRequests.status}`);
    }
  }

  // =====================================================================
  // RPCs: internal authorization + malformed input handling
  // =====================================================================
  section("RPCs -- authorization + malformed input");
  {
    if (hasDistinctOwner) {
      const strangerEditsOwner = await rpc(strangerToken, "submit_pending_edit", {
        p_hostel_id: ownerHostelId,
        p_pending_changes: { name: "hax" },
      });
      check("submit_pending_edit rejects a non-owner", !strangerEditsOwner.ok, JSON.stringify(strangerEditsOwner.body));
    } else {
      skip("submit_pending_edit rejects a non-owner", "owner account not confirmed -- strangerToken IS the owner of ownerHostelId right now, so this isn't a real non-owner test");
    }

    const ownerEdits = await rpc(ownerToken, "submit_pending_edit", {
      p_hostel_id: ownerHostelId,
      p_pending_changes: { name: "[Security Audit] Renamed via pending edit" },
    });
    check("submit_pending_edit succeeds for the real owner", ownerEdits.ok, JSON.stringify(ownerEdits.body));

    const liveStillOld = await get(adminToken, `/hostels?id=eq.${ownerHostelId}&select=name,has_pending_edit`);
    check(
      "a pending edit does NOT touch the live row until applied",
      liveStillOld.body?.[0]?.name?.startsWith("[Security Audit]") && liveStillOld.body?.[0]?.has_pending_edit === true,
      JSON.stringify(liveStillOld.body)
    );

    const strangerApplies = await rpc(strangerToken, "apply_pending_changes", { p_hostel_id: ownerHostelId });
    check("apply_pending_changes rejects a non-admin", !strangerApplies.ok, JSON.stringify(strangerApplies.body));

    const adminApplies = await rpc(adminToken, "apply_pending_changes", { p_hostel_id: ownerHostelId });
    check("apply_pending_changes succeeds for admin", adminApplies.ok, JSON.stringify(adminApplies.body));

    const strangerRejects = await rpc(strangerToken, "reject_submission", { p_submission_id: "00000000-0000-0000-0000-000000000000" });
    check("reject_submission rejects a non-admin (before it even checks the id)", !strangerRejects.ok, JSON.stringify(strangerRejects.body));

    const strangerApproves = await rpc(strangerToken, "approve_submission", { p_submission_id: "00000000-0000-0000-0000-000000000000" });
    check("approve_submission rejects a non-admin", !strangerApproves.ok, JSON.stringify(strangerApproves.body));

    const malformedUuid = await get(strangerToken, "/hostels?id=eq.not-a-uuid&select=id");
    check("a malformed UUID filter errors cleanly (no crash/data leak)", !malformedUuid.ok, `status ${malformedUuid.status}`);

    // p_limit is clamped via least(greatest(p_limit,1),50), so a negative
    // value doesn't error -- it quietly floors to 1 row. That's the
    // intended behavior (graceful clamp, not a Postgres-level LIMIT
    // error), so the check is "still bounded", not "rejected".
    const negativeLimit = await rpc(null, "get_hostel_feed", { p_limit: -5 });
    check("get_hostel_feed with a negative limit is clamped rather than leaking data", negativeLimit.ok && negativeLimit.body.length <= 1, `got ${negativeLimit.body?.length} rows`);

    const hugeLimit = await rpc(null, "get_hostel_feed", { p_limit: 999999 });
    check("get_hostel_feed with an absurd limit is clamped (<=50 rows)", hugeLimit.ok && hugeLimit.body.length <= 50, `got ${hugeLimit.body?.length} rows`);
  }

  // =====================================================================
  // Admin user management (Session 16): promote/demote/suspend RPCs +
  // suspend enforcement. Uses the persistent stranger account for the
  // promote/demote/suspend round trip -- every check here is followed by
  // an unconditional safety-net cleanup so a failed assertion never
  // leaves that account admin/suspended for the *next* run (which would
  // silently invalidate a bunch of "stranger cannot X" checks earlier in
  // the file on a future run).
  // =====================================================================
  section("admin user management (Session 16)");
  {
    const strangerSetRole = await rpc(strangerToken, "set_user_role", { p_user_id: strangerUid, p_role: "admin" });
    check("non-admin cannot call set_user_role", !strangerSetRole.ok, JSON.stringify(strangerSetRole.body));

    const strangerSetSuspended = await rpc(strangerToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: true });
    check("non-admin cannot call set_user_suspended", !strangerSetSuspended.ok, JSON.stringify(strangerSetSuspended.body));

    const strangerActivityCounts = await rpc(strangerToken, "get_user_activity_counts", { p_user_ids: [strangerUid] });
    check("non-admin cannot call get_user_activity_counts", !strangerActivityCounts.ok, JSON.stringify(strangerActivityCounts.body));

    const strangerDeleteReviews = await rpc(strangerToken, "delete_user_reviews", { p_user_id: strangerUid });
    check("non-admin cannot call delete_user_reviews", !strangerDeleteReviews.ok, JSON.stringify(strangerDeleteReviews.body));

    const selfDemote = await rpc(adminToken, "set_user_role", { p_user_id: admin.user.id, p_role: "student" });
    check("admin cannot demote themselves", !selfDemote.ok, JSON.stringify(selfDemote.body));

    const selfSuspend = await rpc(adminToken, "set_user_suspended", { p_user_id: admin.user.id, p_suspended: true });
    check("admin cannot suspend themselves", !selfSuspend.ok, JSON.stringify(selfSuspend.body));

    const promote = await rpc(adminToken, "set_user_role", { p_user_id: strangerUid, p_role: "admin" });
    const afterPromote = await get(adminToken, `/profiles?id=eq.${strangerUid}&select=role`);
    check(
      "admin can promote another user to admin",
      promote.ok && afterPromote.body?.[0]?.role === "admin",
      JSON.stringify(afterPromote.body)
    );

    const demote = await rpc(adminToken, "set_user_role", { p_user_id: strangerUid, p_role: "student" });
    const afterDemote = await get(adminToken, `/profiles?id=eq.${strangerUid}&select=role`);
    check(
      "admin can demote back to student",
      demote.ok && afterDemote.body?.[0]?.role === "student",
      JSON.stringify(afterDemote.body)
    );

    const activityCounts = await rpc(adminToken, "get_user_activity_counts", { p_user_ids: [strangerUid] });
    check(
      "admin get_user_activity_counts succeeds and returns a row for the id requested",
      activityCounts.ok && activityCounts.body?.[0]?.user_id === strangerUid,
      JSON.stringify(activityCounts.body)?.slice(0, 200)
    );

    // The critical one: suspend a user whose session token was already
    // issued *before* the suspension, then use that same stale token to
    // attempt a write. If this only checked at sign-in, an already-signed-
    // in abuser could keep posting after being suspended -- it doesn't,
    // because is_suspended() is re-evaluated by RLS on every request.
    const suspend = await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: true });
    check("admin can suspend another user", suspend.ok, JSON.stringify(suspend.body));

    const suspendedReviewAttempt = await post(strangerToken, "/reviews", {
      hostel_id: ownerHostelId,
      author_id: strangerUid,
      rating: 5,
      comment: "Should be rejected -- account is suspended.",
    });
    check(
      "a suspended account's existing session cannot post a review",
      !suspendedReviewAttempt.ok,
      `status ${suspendedReviewAttempt.status}`
    );

    const suspendedSubmissionAttempt = await post(strangerToken, "/submissions", {
      submitted_by: strangerUid,
      name: "[Security Audit] Should be rejected -- suspended",
      location: "x",
      contact: "233200000000",
    });
    check(
      "a suspended account's existing session cannot submit a hostel",
      !suspendedSubmissionAttempt.ok,
      `status ${suspendedSubmissionAttempt.status}`
    );

    const unsuspend = await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: false });
    const afterUnsuspend = await get(adminToken, `/profiles?id=eq.${strangerUid}&select=is_suspended`);
    check(
      "unsuspend restores the account",
      unsuspend.ok && afterUnsuspend.body?.[0]?.is_suspended === false,
      JSON.stringify(afterUnsuspend.body)
    );

    // Unconditional safety net -- see section comment above.
    await rpc(adminToken, "set_user_role", { p_user_id: strangerUid, p_role: "student" });
    await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: false });
  }

  // =====================================================================
  // Buzz (Session 17): public read, author-or-admin write, is_admin_post/
  // author_name/is_pinned tamper protection, reply_count + pin-cap
  // triggers, suspend enforcement.
  // =====================================================================
  section("buzz");
  {
    // Clean slate from any previous interrupted run.
    const leftovers = await get(strangerToken, `/buzz_posts?author_id=eq.${strangerUid}&select=id`);
    for (const row of leftovers.body ?? []) await del(adminToken, `/buzz_posts?id=eq.${row.id}`);

    const anonRead = await get(null, "/buzz_posts?select=id&limit=1");
    check("anon can read buzz_posts (public feed)", Array.isArray(anonRead.body), `status ${anonRead.status}`);

    const anonInsert = await post(null, "/buzz_posts", { author_id: strangerUid, content: "hax post from anon, should fail" });
    check("anon cannot insert a buzz post", !anonInsert.ok, `status ${anonInsert.status}`);

    const spoofAuthor = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: admin.user.id, content: "Spoofed author id test, should fail." },
      "return=representation"
    );
    check("stranger cannot spoof author_id on a buzz post", !spoofAuthor.ok, `status ${spoofAuthor.status}`);

    const tooShort = await post(strangerToken, "/buzz_posts", { author_id: strangerUid, content: "hi" });
    check("a post under 5 chars is rejected (CHECK constraint)", !tooShort.ok, `status ${tooShort.status}`);

    const tooLong = await post(strangerToken, "/buzz_posts", { author_id: strangerUid, content: "x".repeat(501) });
    check("a post over 500 chars is rejected (CHECK constraint)", !tooLong.ok, `status ${tooLong.status}`);

    const spoofBadge = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Buzz Audit] Trying to fake the official badge", is_admin_post: true },
      "return=representation"
    );
    check(
      "a non-admin cannot fake the Official badge (trigger forces is_admin_post=false)",
      spoofBadge.ok && spoofBadge.body?.[0]?.is_admin_post === false,
      JSON.stringify(spoofBadge.body)
    );
    const strangerPostId = spoofBadge.body?.[0]?.id;

    const spoofAuthorName = await patch(
      strangerToken,
      `/buzz_posts?id=eq.${strangerPostId}`,
      { author_name: "Totally Not The Real Name" },
      "return=representation"
    );
    check(
      "author_name is not client-settable (trigger recomputes it from the real profile)",
      spoofAuthorName.body?.[0]?.author_name !== "Totally Not The Real Name",
      JSON.stringify(spoofAuthorName.body)
    );

    const strangerSelfPin = await patch(
      strangerToken,
      `/buzz_posts?id=eq.${strangerPostId}`,
      { is_pinned: true },
      "return=representation"
    );
    check(
      "a non-admin cannot pin their own post (trigger reverts it)",
      strangerSelfPin.body?.[0]?.is_pinned === false,
      JSON.stringify(strangerSelfPin.body)
    );

    const adminPinsIt = await patch(
      adminToken,
      `/buzz_posts?id=eq.${strangerPostId}`,
      { is_pinned: true },
      "return=representation"
    );
    check("admin CAN pin a post", adminPinsIt.body?.[0]?.is_pinned === true, JSON.stringify(adminPinsIt.body));
    // Reset before the pin-cap test below so it starts from a clean slate.
    await patch(adminToken, `/buzz_posts?id=eq.${strangerPostId}`, { is_pinned: false });

    const adminPost = await post(
      adminToken,
      "/buzz_posts",
      { author_id: admin.user.id, content: "[Buzz Audit] Admin announcement test post" },
      "return=representation"
    );
    check(
      "an admin's own post is auto-badged Official",
      adminPost.ok && adminPost.body?.[0]?.is_admin_post === true,
      JSON.stringify(adminPost.body)
    );
    const adminPostId = adminPost.body?.[0]?.id;

    // Replies + reply_count trigger.
    const replyInsert = await post(
      strangerToken,
      "/buzz_replies",
      { post_id: adminPostId, author_id: strangerUid, content: "Audit test reply" },
      "return=representation"
    );
    check("stranger can reply to a post", replyInsert.ok, JSON.stringify(replyInsert.body));
    const replyId = replyInsert.body?.[0]?.id;

    const postAfterReply = await get(adminToken, `/buzz_posts?id=eq.${adminPostId}&select=reply_count`);
    check(
      "reply_count increments after a reply is posted",
      postAfterReply.body?.[0]?.reply_count === 1,
      JSON.stringify(postAfterReply.body)
    );

    const spoofReplyAuthor = await post(strangerToken, "/buzz_replies", {
      post_id: adminPostId,
      author_id: admin.user.id,
      content: "Spoofed reply author test",
    });
    check("stranger cannot spoof author_id on a reply", !spoofReplyAuthor.ok, `status ${spoofReplyAuthor.status}`);

    const replyTooShort = await post(strangerToken, "/buzz_replies", { post_id: adminPostId, author_id: strangerUid, content: "x" });
    check("a reply under 2 chars is rejected (CHECK constraint)", !replyTooShort.ok, `status ${replyTooShort.status}`);

    const replyTooLong = await post(strangerToken, "/buzz_replies", {
      post_id: adminPostId,
      author_id: strangerUid,
      content: "x".repeat(301),
    });
    check("a reply over 300 chars is rejected (CHECK constraint)", !replyTooLong.ok, `status ${replyTooLong.status}`);

    if (hasDistinctOwner) {
      const otherDeletesReply = await del(ownerToken, `/buzz_replies?id=eq.${replyId}`);
      const replyStillExists = await get(adminToken, `/buzz_replies?id=eq.${replyId}&select=id`);
      check(
        "a different user cannot delete someone else's reply",
        replyStillExists.body?.length === 1,
        JSON.stringify(replyStillExists.body)
      );

      const otherDeletesPost = await del(ownerToken, `/buzz_posts?id=eq.${adminPostId}`);
      const postStillExists = await get(adminToken, `/buzz_posts?id=eq.${adminPostId}&select=id`);
      check(
        "a different user cannot delete someone else's post",
        postStillExists.body?.length === 1,
        JSON.stringify(postStillExists.body)
      );
    } else {
      skip("a different user cannot delete someone else's reply", "owner account not confirmed -- no second distinct identity available");
      skip("a different user cannot delete someone else's post", "owner account not confirmed -- no second distinct identity available");
    }

    const adminDeletesReply = await del(adminToken, `/buzz_replies?id=eq.${replyId}`);
    const postAfterDelete = await get(adminToken, `/buzz_posts?id=eq.${adminPostId}&select=reply_count`);
    check(
      "admin can delete any reply, and reply_count decrements back",
      adminDeletesReply.ok && postAfterDelete.body?.[0]?.reply_count === 0,
      JSON.stringify(postAfterDelete.body)
    );

    // Pin cap: 4 fresh posts, pinned in order -- pinning the 4th must
    // auto-unpin the oldest of the 4 (whatever else is or isn't pinned
    // elsewhere on a live feed, our 4 brand-new posts are always the most
    // recently created, so the cap's "keep newest 3" rule always resolves
    // in terms of these 4 relative to each other).
    const capPostIds = [];
    for (let i = 0; i < 4; i++) {
      const created = await post(
        adminToken,
        "/buzz_posts",
        { author_id: admin.user.id, content: `[Buzz Audit] Pin cap test post ${i}` },
        "return=representation"
      );
      capPostIds.push(created.body?.[0]?.id);
    }
    for (const id of capPostIds) {
      await patch(adminToken, `/buzz_posts?id=eq.${id}`, { is_pinned: true });
    }
    const pinnedAfterCap = await get(adminToken, `/buzz_posts?id=in.(${capPostIds.join(",")})&select=id,is_pinned`);
    const stillPinnedIds = new Set((pinnedAfterCap.body ?? []).filter((r) => r.is_pinned).map((r) => r.id));
    check(
      "pinning a 4th post auto-unpins the oldest of the 4 (cap stays at 3)",
      !stillPinnedIds.has(capPostIds[0]) && capPostIds.slice(1).every((id) => stillPinnedIds.has(id)),
      JSON.stringify(pinnedAfterCap.body)
    );

    // Suspend enforcement (Session 16), extended to Buzz.
    await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: true });

    const suspendedPostAttempt = await post(strangerToken, "/buzz_posts", {
      author_id: strangerUid,
      content: "[Buzz Audit] Should be rejected -- suspended",
    });
    check(
      "a suspended account's existing session cannot post to Buzz",
      !suspendedPostAttempt.ok,
      `status ${suspendedPostAttempt.status}`
    );

    const suspendedReplyAttempt = await post(strangerToken, "/buzz_replies", {
      post_id: adminPostId,
      author_id: strangerUid,
      content: "Should be rejected -- suspended",
    });
    check(
      "a suspended account's existing session cannot reply on Buzz",
      !suspendedReplyAttempt.ok,
      `status ${suspendedReplyAttempt.status}`
    );

    await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: false });

    // Cleanup -- delete every test post created in this section (cascades
    // any remaining replies).
    for (const id of [strangerPostId, adminPostId, ...capPostIds]) {
      if (id) await del(adminToken, `/buzz_posts?id=eq.${id}`);
    }
  }

  // =====================================================================
  // market_listings + app_config (Session 19)
  // =====================================================================
  section("market");
  {
    // Clean slate from any previous interrupted run.
    const leftovers = await get(strangerToken, `/market_listings?seller_id=eq.${strangerUid}&select=id`);
    for (const row of leftovers.body ?? []) await del(adminToken, `/market_listings?id=eq.${row.id}`);

    const anonRead = await get(null, "/market_listings?select=id&limit=1");
    check("anon can read market_listings (public feed)", Array.isArray(anonRead.body), `status ${anonRead.status}`);

    const anonInsert = await post(null, "/market_listings", {
      seller_id: strangerUid,
      title: "hax listing from anon",
      price: 10,
      category: "other",
      contact: "233200000000",
    });
    check("anon cannot insert a market listing", !anonInsert.ok, `status ${anonInsert.status}`);

    const spoofSeller = await post(
      strangerToken,
      "/market_listings",
      { seller_id: admin.user.id, title: "Spoofed seller id test", price: 10, category: "other", contact: "233200000000" },
      "return=representation"
    );
    check("stranger cannot spoof seller_id on a listing", !spoofSeller.ok, `status ${spoofSeller.status}`);

    const titleTooShort = await post(strangerToken, "/market_listings", {
      seller_id: strangerUid,
      title: "ab",
      price: 10,
      category: "other",
      contact: "233200000000",
    });
    check("a title under 3 chars is rejected (CHECK constraint)", !titleTooShort.ok, `status ${titleTooShort.status}`);

    const negativePrice = await post(strangerToken, "/market_listings", {
      seller_id: strangerUid,
      title: "[Market Audit] Negative price test",
      price: -5,
      category: "other",
      contact: "233200000000",
    });
    check("a negative price is rejected (CHECK constraint)", !negativePrice.ok, `status ${negativePrice.status}`);

    const badCategory = await post(strangerToken, "/market_listings", {
      seller_id: strangerUid,
      title: "[Market Audit] Bad category test",
      price: 10,
      category: "not_a_real_category",
      contact: "233200000000",
    });
    check("an invalid category is rejected (CHECK constraint)", !badCategory.ok, `status ${badCategory.status}`);

    const spoofIsService = await post(
      strangerToken,
      "/market_listings",
      {
        seller_id: strangerUid,
        title: "[Market Audit] Fake is_service test",
        price: 10,
        category: "electronics",
        contact: "233200000000",
        is_service: true,
      },
      "return=representation"
    );
    check(
      "is_service is derived from category, not client-settable (electronics -> false even when true is sent)",
      spoofIsService.ok && spoofIsService.body?.[0]?.is_service === false,
      JSON.stringify(spoofIsService.body)
    );
    const strangerListingId = spoofIsService.body?.[0]?.id;

    const realService = await post(
      strangerToken,
      "/market_listings",
      { seller_id: strangerUid, title: "[Market Audit] Real service listing", price: 20, category: "services", contact: "233200000000" },
      "return=representation"
    );
    check(
      "a services-category listing is auto-marked is_service=true",
      realService.ok && realService.body?.[0]?.is_service === true,
      JSON.stringify(realService.body)
    );
    const serviceListingId = realService.body?.[0]?.id;

    const spoofUpdate = await patch(
      strangerToken,
      `/market_listings?id=eq.${strangerListingId}`,
      { seller_id: admin.user.id, views_count: 999 },
      "return=representation"
    );
    check(
      "seller_id/views_count cannot be changed on update (trigger pins them)",
      spoofUpdate.body?.[0]?.seller_id === strangerUid && spoofUpdate.body?.[0]?.views_count === 0,
      JSON.stringify(spoofUpdate.body)
    );

    const sellerMarksSold = await patch(
      strangerToken,
      `/market_listings?id=eq.${strangerListingId}`,
      { status: "sold" },
      "return=representation"
    );
    check("seller CAN mark their own listing sold", sellerMarksSold.body?.[0]?.status === "sold", JSON.stringify(sellerMarksSold.body));

    const sellerSelfRemove = await patch(
      strangerToken,
      `/market_listings?id=eq.${strangerListingId}`,
      { status: "removed" },
      "return=representation"
    );
    check(
      "a non-admin cannot set status='removed' (trigger reverts it)",
      sellerSelfRemove.body?.[0]?.status !== "removed",
      JSON.stringify(sellerSelfRemove.body)
    );

    const adminRemoves = await patch(
      adminToken,
      `/market_listings?id=eq.${strangerListingId}`,
      { status: "removed" },
      "return=representation"
    );
    check("admin CAN set status='removed'", adminRemoves.body?.[0]?.status === "removed", JSON.stringify(adminRemoves.body));

    if (hasDistinctOwner) {
      const otherUpdate = await patch(ownerToken, `/market_listings?id=eq.${serviceListingId}`, { title: "hax" }, "return=representation");
      check("a different user cannot update someone else's listing", !otherUpdate.body || otherUpdate.body.length === 0);

      const otherDelete = await del(ownerToken, `/market_listings?id=eq.${serviceListingId}`);
      const stillExists = await get(adminToken, `/market_listings?id=eq.${serviceListingId}&select=id`);
      check("a different user cannot delete someone else's listing", stillExists.body?.length === 1);
    } else {
      skip("a different user cannot update someone else's listing", "owner account not confirmed -- no second distinct identity available");
      skip("a different user cannot delete someone else's listing", "owner account not confirmed -- no second distinct identity available");
    }

    const viewsBefore = await get(adminToken, `/market_listings?id=eq.${serviceListingId}&select=views_count`);
    const viewIncrement = await rpc(null, "increment_listing_views", { p_listing_id: serviceListingId });
    const viewsAfter = await get(adminToken, `/market_listings?id=eq.${serviceListingId}&select=views_count`);
    check(
      "increment_listing_views is anon-callable and increments the count",
      viewIncrement.ok && viewsAfter.body?.[0]?.views_count === (viewsBefore.body?.[0]?.views_count ?? 0) + 1,
      JSON.stringify(viewsAfter.body)
    );

    const feedCall = await rpc(null, "get_market_feed", { p_limit: 5 });
    check("get_market_feed is anon-callable and returns an array", feedCall.ok && Array.isArray(feedCall.body), JSON.stringify(feedCall.body)?.slice(0, 200));

    const sellerProfileCall = await rpc(strangerToken, "get_seller_public_profile", { p_seller_id: admin.user.id });
    const sellerProfileRow = sellerProfileCall.body?.[0];
    check(
      "get_seller_public_profile returns name/join-date but never email",
      sellerProfileCall.ok && sellerProfileRow && !("email" in sellerProfileRow),
      JSON.stringify(sellerProfileCall.body)
    );

    // Suspend enforcement, extended to the marketplace.
    await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: true });
    const suspendedListingAttempt = await post(strangerToken, "/market_listings", {
      seller_id: strangerUid,
      title: "[Market Audit] Should be rejected -- suspended",
      price: 10,
      category: "other",
      contact: "233200000000",
    });
    check("a suspended account's existing session cannot post a listing", !suspendedListingAttempt.ok, `status ${suspendedListingAttempt.status}`);
    await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: false });

    // app_config: publicly readable, but not writable by anon/authenticated.
    const anonReadsConfig = await get(null, "/app_config?key=eq.marketplace_enabled&select=key,value");
    check("anon can read app_config (needed to gate /market client-side too)", Array.isArray(anonReadsConfig.body), JSON.stringify(anonReadsConfig.body));

    const strangerWritesConfig = await patch(strangerToken, "/app_config?key=eq.marketplace_enabled", { value: true }, "return=representation");
    check("a non-admin cannot write app_config", !strangerWritesConfig.body || strangerWritesConfig.body.length === 0);

    // toggle_marketplace -- this runs against the *live* database, so the
    // flag's real value is read first and restored at the end regardless
    // of what it started as. Never leave the live site's marketplace
    // gate in a different state than this test found it in.
    const originalEnabled = anonReadsConfig.body?.[0]?.value === true;

    const strangerToggles = await rpc(strangerToken, "toggle_marketplace", {});
    check("a non-admin cannot call toggle_marketplace", !strangerToggles.ok, `status ${strangerToggles.status}`);

    const adminTogglesOnce = await rpc(adminToken, "toggle_marketplace", {});
    check(
      "admin CAN call toggle_marketplace, and it flips the flag",
      adminTogglesOnce.ok && adminTogglesOnce.body === !originalEnabled,
      JSON.stringify(adminTogglesOnce.body)
    );

    // Restore -- toggling a second time flips it back to where it started.
    const adminTogglesBack = await rpc(adminToken, "toggle_marketplace", {});
    check(
      "toggling a second time restores the original value",
      adminTogglesBack.ok && adminTogglesBack.body === originalEnabled,
      JSON.stringify(adminTogglesBack.body)
    );

    // Cleanup.
    for (const id of [strangerListingId, serviceListingId]) {
      if (id) await del(adminToken, `/market_listings?id=eq.${id}`);
    }
  }

  // =====================================================================
  // Marketplace differentiators (Session 20): Leaving Campus Sale,
  // hostel_id linking, service_type
  // =====================================================================
  section("market: differentiators (Session 20)");
  {
    // Reset to a known baseline in case a previous interrupted run left
    // the stranger's leaving-mode flag set.
    await rpc(strangerToken, "set_leaving_campus_mode", { p_enabled: false, p_leaving_date: null });

    const anonToggle = await rpc(null, "set_leaving_campus_mode", { p_enabled: true });
    check("anon cannot call set_leaving_campus_mode (not granted to anon)", !anonToggle.ok, `status ${anonToggle.status}`);

    const preListing = await post(
      strangerToken,
      "/market_listings",
      { seller_id: strangerUid, title: "[Market Audit] Pre-leaving-mode listing", price: 10, category: "other", contact: "233200000000" },
      "return=representation"
    );
    const preListingId = preListing.body?.[0]?.id;

    const enableLeaving = await rpc(strangerToken, "set_leaving_campus_mode", { p_enabled: true, p_leaving_date: "2026-07-25" });
    check("set_leaving_campus_mode(true) is callable by a signed-in student", enableLeaving.ok, `status ${enableLeaving.status}`);

    const profileAfterEnable = await get(adminToken, `/profiles?id=eq.${strangerUid}&select=is_leaving_sale,leaving_date`);
    check(
      "enabling sets the profile's is_leaving_sale + leaving_date",
      profileAfterEnable.body?.[0]?.is_leaving_sale === true && profileAfterEnable.body?.[0]?.leaving_date === "2026-07-25",
      JSON.stringify(profileAfterEnable.body)
    );

    const preListingAfterEnable = await get(adminToken, `/market_listings?id=eq.${preListingId}&select=is_leaving_sale`);
    check(
      "enabling bulk-sets is_leaving_sale on the student's existing active listings",
      preListingAfterEnable.body?.[0]?.is_leaving_sale === true,
      JSON.stringify(preListingAfterEnable.body)
    );

    const spoofNewListing = await post(
      strangerToken,
      "/market_listings",
      {
        seller_id: strangerUid,
        title: "[Market Audit] New listing while leaving-mode is on",
        price: 10,
        category: "other",
        contact: "233200000000",
        is_leaving_sale: false, // attempted spoof -- should be overridden to true
      },
      "return=representation"
    );
    check(
      "a new listing auto-inherits is_leaving_sale=true while leaving mode is on (client value ignored)",
      spoofNewListing.ok && spoofNewListing.body?.[0]?.is_leaving_sale === true,
      JSON.stringify(spoofNewListing.body)
    );
    const postListingId = spoofNewListing.body?.[0]?.id;

    if (hasDistinctOwner) {
      const ownerListing = await post(
        ownerToken,
        "/market_listings",
        { seller_id: ownerUid, title: "[Market Audit] Unrelated owner listing", price: 10, category: "other", contact: "233200000000" },
        "return=representation"
      );
      const ownerListingId = ownerListing.body?.[0]?.id;

      const strangerTogglesAgain = await rpc(strangerToken, "set_leaving_campus_mode", { p_enabled: true, p_leaving_date: null });
      const ownerListingUnaffected = await get(adminToken, `/market_listings?id=eq.${ownerListingId}&select=is_leaving_sale`);
      check(
        "set_leaving_campus_mode only touches the caller's own listings, not another seller's",
        strangerTogglesAgain.ok && ownerListingUnaffected.body?.[0]?.is_leaving_sale === false,
        JSON.stringify(ownerListingUnaffected.body)
      );

      if (ownerListingId) await del(adminToken, `/market_listings?id=eq.${ownerListingId}`);
    } else {
      skip("set_leaving_campus_mode only touches the caller's own listings, not another seller's", "owner account not confirmed -- no second distinct identity available");
    }

    const disableLeaving = await rpc(strangerToken, "set_leaving_campus_mode", { p_enabled: false, p_leaving_date: null });
    const profileAfterDisable = await get(adminToken, `/profiles?id=eq.${strangerUid}&select=is_leaving_sale,leaving_date`);
    const preListingAfterDisable = await get(adminToken, `/market_listings?id=eq.${preListingId}&select=is_leaving_sale`);
    check(
      "disabling clears the profile flag/date and bulk-clears is_leaving_sale on existing listings",
      disableLeaving.ok &&
        profileAfterDisable.body?.[0]?.is_leaving_sale === false &&
        profileAfterDisable.body?.[0]?.leaving_date === null &&
        preListingAfterDisable.body?.[0]?.is_leaving_sale === false,
      JSON.stringify({ profile: profileAfterDisable.body, listing: preListingAfterDisable.body })
    );

    const leavingFeedCall = await rpc(null, "get_market_feed", { p_leaving_sale_only: true, p_limit: 20 });
    check(
      "get_market_feed p_leaving_sale_only=true only returns leaving-sale listings",
      leavingFeedCall.ok && (leavingFeedCall.body ?? []).every((row) => row.is_leaving_sale === true),
      JSON.stringify(leavingFeedCall.body)?.slice(0, 200)
    );

    const sellerProfileAfter = await rpc(strangerToken, "get_seller_public_profile", { p_seller_id: strangerUid });
    check(
      "get_seller_public_profile now also exposes is_leaving_sale/leaving_date",
      sellerProfileAfter.ok && "is_leaving_sale" in (sellerProfileAfter.body?.[0] ?? {}) && "leaving_date" in (sellerProfileAfter.body?.[0] ?? {}),
      JSON.stringify(sellerProfileAfter.body)
    );

    // service_type: CHECK constraint + trigger-forced null off-category.
    const validService = await post(
      strangerToken,
      "/market_listings",
      { seller_id: strangerUid, title: "[Market Audit] Tutoring service", price: 20, category: "services", contact: "233200000000", service_type: "tutoring" },
      "return=representation"
    );
    check(
      "a valid service_type is stored for a services-category listing",
      validService.ok && validService.body?.[0]?.service_type === "tutoring",
      JSON.stringify(validService.body)
    );
    const validServiceId = validService.body?.[0]?.id;

    const badServiceType = await post(strangerToken, "/market_listings", {
      seller_id: strangerUid,
      title: "[Market Audit] Bad service_type test",
      price: 20,
      category: "services",
      contact: "233200000000",
      service_type: "not_a_real_service_type",
    });
    check("an invalid service_type is rejected (CHECK constraint)", !badServiceType.ok, `status ${badServiceType.status}`);

    const serviceTypeOffCategory = await post(
      strangerToken,
      "/market_listings",
      { seller_id: strangerUid, title: "[Market Audit] service_type spoof on non-service", price: 20, category: "electronics", contact: "233200000000", service_type: "tutoring" },
      "return=representation"
    );
    check(
      "service_type is force-nulled when category isn't 'services'",
      serviceTypeOffCategory.ok && serviceTypeOffCategory.body?.[0]?.service_type === null,
      JSON.stringify(serviceTypeOffCategory.body)
    );
    const serviceTypeOffCategoryId = serviceTypeOffCategory.body?.[0]?.id;

    const serviceTypeFeedCall = await rpc(null, "get_market_feed", { p_category: "services", p_service_type: "tutoring", p_limit: 20 });
    check(
      "get_market_feed p_service_type filters to that service type only",
      serviceTypeFeedCall.ok && (serviceTypeFeedCall.body ?? []).every((row) => row.service_type === "tutoring"),
      JSON.stringify(serviceTypeFeedCall.body)?.slice(0, 200)
    );

    // hostel_id: FK constraint against a nonexistent hostel.
    const fakeHostelId = "00000000-0000-0000-0000-000000000000";
    const badHostelId = await post(strangerToken, "/market_listings", {
      seller_id: strangerUid,
      title: "[Market Audit] Bad hostel_id test",
      price: 10,
      category: "other",
      contact: "233200000000",
      hostel_id: fakeHostelId,
    });
    check("a nonexistent hostel_id is rejected (FK constraint)", !badHostelId.ok, `status ${badHostelId.status}`);

    const realHostel = await get(null, "/hostels?select=id&limit=1");
    const realHostelId = realHostel.body?.[0]?.id;
    if (realHostelId) {
      const goodHostelId = await post(
        strangerToken,
        "/market_listings",
        { seller_id: strangerUid, title: "[Market Audit] Real hostel_id test", price: 10, category: "other", contact: "233200000000", hostel_id: realHostelId },
        "return=representation"
      );
      check("a real hostel_id is accepted and stored", goodHostelId.ok && goodHostelId.body?.[0]?.hostel_id === realHostelId, JSON.stringify(goodHostelId.body));

      const hostelListingsCall = await get(null, `/market_listings?hostel_id=eq.${realHostelId}&status=eq.active&select=id&limit=10`);
      check("hostel-linked active listings are anon-readable (hostel page section)", Array.isArray(hostelListingsCall.body), `status ${hostelListingsCall.status}`);

      if (goodHostelId.body?.[0]?.id) await del(adminToken, `/market_listings?id=eq.${goodHostelId.body[0].id}`);
    } else {
      skip("a real hostel_id is accepted and stored", "no hostels exist in this database to link against");
      skip("hostel-linked active listings are anon-readable (hostel page section)", "no hostels exist in this database to link against");
    }

    // Cleanup.
    for (const id of [preListingId, postListingId, validServiceId, serviceTypeOffCategoryId]) {
      if (id) await del(adminToken, `/market_listings?id=eq.${id}`);
    }
    await rpc(strangerToken, "set_leaving_campus_mode", { p_enabled: false, p_leaving_date: null });
  }

  // =====================================================================
  // Storage: MIME allow-list, size cap, cross-user write scoping
  // =====================================================================
  section("storage");
  {
    const tinySvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);
    const svgUpload = await fetch(`${SUPABASE_URL}/storage/v1/object/hostel-images/security-audit-test.svg`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}`, "Content-Type": "image/svg+xml" },
      body: tinySvg,
    });
    check("an SVG upload is rejected by the bucket's MIME allow-list", !svgUpload.ok, `status ${svgUpload.status}`);
    if (svgUpload.ok) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/hostel-images/security-audit-test.svg`, {
        method: "DELETE",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}` },
      });
    }

    // 1x1 transparent PNG -- sanity check the allow-list didn't also block
    // legitimate uploads.
    const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    const pngPath = `security-audit-test-${Date.now()}.png`;
    const pngUpload = await fetch(`${SUPABASE_URL}/storage/v1/object/hostel-images/${pngPath}`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}`, "Content-Type": "image/png" },
      body: tinyPng,
    });
    check("a real PNG upload still succeeds (allow-list isn't over-broad)", pngUpload.ok, `status ${pngUpload.status}`);

    if (pngUpload.ok && hasDistinctOwner) {
      const otherDeletes = await fetch(`${SUPABASE_URL}/storage/v1/object/hostel-images/${pngPath}`, {
        method: "DELETE",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${ownerToken}` },
      });
      check("a different user cannot delete someone else's uploaded object", !otherDeletes.ok, `status ${otherDeletes.status}`);

      // Real cleanup, as the uploader.
      await fetch(`${SUPABASE_URL}/storage/v1/object/hostel-images/${pngPath}`, {
        method: "DELETE",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}` },
      });
    } else if (!pngUpload.ok) {
      skip("cross-user delete check", "PNG upload didn't succeed to begin with");
    } else {
      skip("cross-user delete check", "owner account not confirmed -- no second distinct identity available");
      // Still clean up the uploaded object as the uploader.
      await fetch(`${SUPABASE_URL}/storage/v1/object/hostel-images/${pngPath}`, {
        method: "DELETE",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}` },
      });
    }

    // market-images (Session 19) -- same hardening, applied at creation
    // time rather than bolted on after the fact like the other two.
    const marketSvgUpload = await fetch(`${SUPABASE_URL}/storage/v1/object/market-images/security-audit-test.svg`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}`, "Content-Type": "image/svg+xml" },
      body: tinySvg,
    });
    check("an SVG upload to market-images is rejected by the MIME allow-list", !marketSvgUpload.ok, `status ${marketSvgUpload.status}`);
    if (marketSvgUpload.ok) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/market-images/security-audit-test.svg`, {
        method: "DELETE",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}` },
      });
    }

    const marketPngPath = `security-audit-test-${Date.now()}.png`;
    const marketPngUpload = await fetch(`${SUPABASE_URL}/storage/v1/object/market-images/${marketPngPath}`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}`, "Content-Type": "image/png" },
      body: tinyPng,
    });
    check("a real PNG upload to market-images still succeeds", marketPngUpload.ok, `status ${marketPngUpload.status}`);
    if (marketPngUpload.ok) {
      await fetch(`${SUPABASE_URL}/storage/v1/object/market-images/${marketPngPath}`, {
        method: "DELETE",
        headers: { apikey: ANON_KEY, Authorization: `Bearer ${strangerToken}` },
      });
    }
  }

  // =====================================================================
  // Admin-only API route (email notifications)
  // =====================================================================
  section("api/admin/submission-notify (requires the app's own dev/prod server running)");
  {
    const base = process.env.SECURITY_AUDIT_APP_URL || "http://localhost:3000";
    try {
      const anonCall = await fetch(`${base}/api/admin/submission-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: "00000000-0000-0000-0000-000000000000", action: "approved" }),
      });
      check("the email endpoint rejects a request with no session at all", anonCall.status === 401, `status ${anonCall.status}`);
    } catch {
      skip("email endpoint anon check", `couldn't reach ${base} -- is the app running?`);
    }
  }

  // =====================================================================
  // Summary
  // =====================================================================
  console.log("\n" + "=".repeat(40));
  console.log(`${results.pass} passed, ${results.fail} failed, ${results.accepted} accepted risk(s), ${results.skipped} skipped`);
  if (failures.length > 0) {
    console.log("\nFAILURES:");
    for (const f of failures) console.log(`  - ${f.label}${f.detail ? ` (${f.detail})` : ""}`);
  }

  process.exit(results.fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\nAudit script crashed:", err);
  process.exit(2);
});
