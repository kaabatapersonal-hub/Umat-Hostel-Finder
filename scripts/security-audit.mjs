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
  console.log("Campa -- security audit\n" + "=".repeat(40));

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
  // Admin analytics (Growth/Engagement stat cards)
  // =====================================================================
  section("admin analytics");
  {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const anonActiveUsers = await rpc(null, "get_active_users_count", { p_since: since });
    check("anon cannot call get_active_users_count (not granted to anon)", !anonActiveUsers.ok, `status ${anonActiveUsers.status}`);

    const strangerActiveUsers = await rpc(strangerToken, "get_active_users_count", { p_since: since });
    check("non-admin cannot call get_active_users_count", !strangerActiveUsers.ok, JSON.stringify(strangerActiveUsers.body));

    const adminActiveUsers = await rpc(adminToken, "get_active_users_count", { p_since: since });
    check(
      "admin CAN call get_active_users_count and gets a number back",
      adminActiveUsers.ok && typeof adminActiveUsers.body === "number",
      JSON.stringify(adminActiveUsers.body)
    );
  }

  // =====================================================================
  // Verified users (Session 22 Part 1)
  // =====================================================================
  section("verified users (Session 22)");
  {
    const anonToggleVerify = await rpc(null, "set_user_verified", { p_user_id: strangerUid, p_verified: true });
    check("anon cannot call set_user_verified", !anonToggleVerify.ok, `status ${anonToggleVerify.status}`);

    const strangerSelfVerify = await rpc(strangerToken, "set_user_verified", {
      p_user_id: strangerUid,
      p_verified: true,
      p_label: "Fake Badge",
    });
    check("a non-admin cannot call set_user_verified", !strangerSelfVerify.ok, JSON.stringify(strangerSelfVerify.body));

    const strangerDirectVerify = await patch(
      strangerToken,
      `/profiles?id=eq.${strangerUid}`,
      { is_verified: true, verification_label: "Self-verified" },
      "return=representation"
    );
    check(
      "a non-admin cannot set is_verified via direct PATCH (trigger reverts it)",
      strangerDirectVerify.body?.[0]?.is_verified === false,
      JSON.stringify(strangerDirectVerify.body)
    );

    const adminVerifies = await rpc(adminToken, "set_user_verified", {
      p_user_id: strangerUid,
      p_verified: true,
      p_label: "Campus Influencer",
    });
    const afterVerify = await get(adminToken, `/profiles?id=eq.${strangerUid}&select=is_verified,verification_label`);
    check(
      "admin (manage_users) CAN verify a user with a label",
      adminVerifies.ok && afterVerify.body?.[0]?.is_verified === true && afterVerify.body?.[0]?.verification_label === "Campus Influencer",
      JSON.stringify(afterVerify.body)
    );

    const publicVerifiedLookup = await rpc(null, "get_verified_profiles", { p_user_ids: [strangerUid, admin.user.id] });
    check(
      "get_verified_profiles is anon-callable and only returns the verified id",
      publicVerifiedLookup.ok && publicVerifiedLookup.body?.length === 1 && publicVerifiedLookup.body?.[0]?.id === strangerUid,
      JSON.stringify(publicVerifiedLookup.body)
    );

    const sellerProfileVerified = await rpc(null, "get_seller_public_profile", { p_seller_id: strangerUid });
    check(
      "get_seller_public_profile now also exposes is_verified/verification_label",
      sellerProfileVerified.ok && sellerProfileVerified.body?.[0]?.is_verified === true,
      JSON.stringify(sellerProfileVerified.body)
    );

    const adminUnverifies = await rpc(adminToken, "set_user_verified", { p_user_id: strangerUid, p_verified: false });
    const afterUnverify = await get(adminToken, `/profiles?id=eq.${strangerUid}&select=is_verified,verification_label`);
    check(
      "admin can remove verification (label clears too)",
      adminUnverifies.ok && afterUnverify.body?.[0]?.is_verified === false && afterUnverify.body?.[0]?.verification_label === null,
      JSON.stringify(afterUnverify.body)
    );
  }

  // =====================================================================
  // Admin role permissions (Session 22 Part 2): super admin vs sub-admin
  // =====================================================================
  section("admin permissions (Session 22)");
  {
    const superAdminCheck = await get(adminToken, `/profiles?id=eq.${admin.user.id}&select=is_super_admin`);
    check(
      "the bootstrap admin account is the super admin",
      superAdminCheck.body?.[0]?.is_super_admin === true,
      JSON.stringify(superAdminCheck.body)
    );

    // Give stranger a deliberately narrow sub-admin grant -- moderate_buzz
    // only -- to exercise every "doesn't have this permission" rejection
    // with a real signed-in admin session, not just a plain student.
    const grantSubAdmin = await rpc(adminToken, "set_user_role", {
      p_user_id: strangerUid,
      p_role: "admin",
      p_permissions: ["moderate_buzz"],
    });
    const afterGrant = await get(adminToken, `/profiles?id=eq.${strangerUid}&select=role,admin_permissions,is_super_admin`);
    check(
      "super admin can promote with a specific permission set",
      grantSubAdmin.ok &&
        afterGrant.body?.[0]?.role === "admin" &&
        JSON.stringify(afterGrant.body?.[0]?.admin_permissions) === JSON.stringify(["moderate_buzz"]),
      JSON.stringify(afterGrant.body)
    );

    const subAdminPromotesSelf = await rpc(strangerToken, "set_user_role", {
      p_user_id: strangerUid,
      p_role: "admin",
      p_permissions: ["manage_hostels"],
    });
    check("a sub-admin cannot call set_user_role at all (super admin only)", !subAdminPromotesSelf.ok, JSON.stringify(subAdminPromotesSelf.body));

    const subAdminChangesOwnPermissions = await patch(
      strangerToken,
      `/profiles?id=eq.${strangerUid}`,
      { admin_permissions: ["manage_hostels", "manage_users", "moderate_market", "moderate_reviews"] },
      "return=representation"
    );
    check(
      "a sub-admin cannot change their own admin_permissions via direct PATCH (trigger reverts it)",
      JSON.stringify(subAdminChangesOwnPermissions.body?.[0]?.admin_permissions) === JSON.stringify(["moderate_buzz"]),
      JSON.stringify(subAdminChangesOwnPermissions.body)
    );

    // Has moderate_buzz -- CAN moderate Buzz.
    const buzzPostForSubAdminTest = await post(
      adminToken,
      "/buzz_posts",
      { author_id: admin.user.id, content: "[Security Audit] Sub-admin permission test post" },
      "return=representation"
    );
    const subAdminTestPostId = buzzPostForSubAdminTest.body?.[0]?.id;
    const subAdminPinsPost = await patch(strangerToken, `/buzz_posts?id=eq.${subAdminTestPostId}`, { is_pinned: true }, "return=representation");
    check(
      "a sub-admin WITH moderate_buzz can pin someone else's post",
      subAdminPinsPost.body?.[0]?.is_pinned === true,
      JSON.stringify(subAdminPinsPost.body)
    );

    // Doesn't have manage_hostels -- CANNOT touch hostels or the
    // submission review queue.
    const subAdminInsertsHostel = await post(strangerToken, "/hostels", {
      name: "[Security Audit] Sub-admin hostel test",
      location: "x",
      contact: "233200000000",
    });
    check("a sub-admin WITHOUT manage_hostels cannot insert a hostel", !subAdminInsertsHostel.ok, `status ${subAdminInsertsHostel.status}`);

    const subAdminApprovesSubmission = await rpc(strangerToken, "approve_submission", {
      p_submission_id: "00000000-0000-0000-0000-000000000000",
    });
    check(
      "a sub-admin WITHOUT manage_hostels cannot call approve_submission",
      !subAdminApprovesSubmission.ok,
      JSON.stringify(subAdminApprovesSubmission.body)
    );

    // Doesn't have moderate_reviews -- CANNOT touch reviews as admin.
    const subAdminDeletesUserReviews = await rpc(strangerToken, "delete_user_reviews", { p_user_id: strangerUid });
    check(
      "a sub-admin WITHOUT moderate_reviews cannot call delete_user_reviews",
      !subAdminDeletesUserReviews.ok,
      JSON.stringify(subAdminDeletesUserReviews.body)
    );

    // Doesn't have moderate_market -- CANNOT touch marketplace admin
    // actions.
    const subAdminTogglesMarketplace = await rpc(strangerToken, "toggle_marketplace", {});
    check(
      "a sub-admin WITHOUT moderate_market cannot call toggle_marketplace",
      !subAdminTogglesMarketplace.ok,
      JSON.stringify(subAdminTogglesMarketplace.body)
    );

    // Doesn't have manage_users -- CANNOT manage other users, even though
    // they're an admin themselves.
    const subAdminSuspendsSomeone = await rpc(strangerToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: false });
    check(
      "a sub-admin WITHOUT manage_users cannot call set_user_suspended",
      !subAdminSuspendsSomeone.ok,
      JSON.stringify(subAdminSuspendsSomeone.body)
    );

    const subAdminVerifiesSomeone = await rpc(strangerToken, "set_user_verified", { p_user_id: strangerUid, p_verified: true });
    check(
      "a sub-admin WITHOUT manage_users cannot call set_user_verified",
      !subAdminVerifiesSomeone.ok,
      JSON.stringify(subAdminVerifiesSomeone.body)
    );

    // Invalid permission key rejected outright.
    const badPermission = await rpc(adminToken, "set_user_role", {
      p_user_id: strangerUid,
      p_role: "admin",
      p_permissions: ["not_a_real_permission"],
    });
    check("set_user_role rejects an unknown permission key", !badPermission.ok, JSON.stringify(badPermission.body));

    // Super admin protections.
    const cannotSuspendSuperAdmin = await rpc(adminToken, "set_user_suspended", { p_user_id: admin.user.id, p_suspended: true });
    check(
      "the super admin cannot be suspended (self-suspend guard covers this case)",
      !cannotSuspendSuperAdmin.ok,
      JSON.stringify(cannotSuspendSuperAdmin.body)
    );

    const directIsSuperAdminEdit = await patch(adminToken, `/profiles?id=eq.${strangerUid}`, { is_super_admin: true }, "return=representation");
    check(
      "is_super_admin can never be set via direct PATCH, even by the super admin",
      // Either the RLS policy blocks the direct write outright (no rows
      // matched -- admins can't PATCH another user's profile row at all,
      // only via RPCs) or the row comes back with is_super_admin still
      // false (the trigger reverted it). Both mean "it can never be set."
      (directIsSuperAdminEdit.body ?? []).every((row) => row.is_super_admin === false),
      JSON.stringify(directIsSuperAdminEdit.body)
    );

    // Cleanup: demote stranger back to a plain student, delete the test
    // post -- later sections assume stranger is an ordinary non-admin.
    const cleanupDemote = await rpc(adminToken, "set_user_role", { p_user_id: strangerUid, p_role: "student" });
    const afterCleanup = await get(adminToken, `/profiles?id=eq.${strangerUid}&select=role,admin_permissions`);
    check(
      "demoting back to student clears admin_permissions too",
      cleanupDemote.ok && afterCleanup.body?.[0]?.role === "student" && JSON.stringify(afterCleanup.body?.[0]?.admin_permissions) === JSON.stringify([]),
      JSON.stringify(afterCleanup.body)
    );

    if (subAdminTestPostId) await del(adminToken, `/buzz_posts?id=eq.${subAdminTestPostId}`);
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
  // buzz_likes (Buzz v2 -- replaces the 5-emoji buzz_reactions)
  // =====================================================================
  section("buzz: likes (Buzz v2)");
  {
    const likePost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Buzz Audit] Likes test post" },
      "return=representation"
    );
    const likePostId = likePost.body?.[0]?.id;

    const anonDirectInsert = await post(null, "/buzz_likes", { post_id: likePostId, user_id: strangerUid });
    check("anon cannot insert a like directly", !anonDirectInsert.ok, `status ${anonDirectInsert.status}`);

    const firstLike = await post(strangerToken, "/buzz_likes", { post_id: likePostId, user_id: strangerUid }, "return=representation");
    check("stranger can like a post", firstLike.ok, JSON.stringify(firstLike.body));

    const countAfterLike = await get(adminToken, `/buzz_posts?id=eq.${likePostId}&select=like_count`);
    check("like_count reflects the new like", countAfterLike.body?.[0]?.like_count === 1, JSON.stringify(countAfterLike.body));

    const unlike = await del(strangerToken, `/buzz_likes?post_id=eq.${likePostId}&user_id=eq.${strangerUid}`);
    check("stranger can unlike (delete their own like)", unlike.ok, `status ${unlike.status}`);

    const countAfterUnlike = await get(adminToken, `/buzz_posts?id=eq.${likePostId}&select=like_count`);
    check("like_count drops back to 0 after unliking", countAfterUnlike.body?.[0]?.like_count === 0, JSON.stringify(countAfterUnlike.body));

    const spoofLikeUser = await post(strangerToken, "/buzz_likes", { post_id: likePostId, user_id: admin.user.id });
    check("stranger cannot spoof user_id on a like", !spoofLikeUser.ok, `status ${spoofLikeUser.status}`);

    const realLike = await post(strangerToken, "/buzz_likes", { post_id: likePostId, user_id: strangerUid }, "return=representation");
    const duplicateLike = await post(strangerToken, "/buzz_likes", { post_id: likePostId, user_id: strangerUid });
    check(
      "the same user liking the same post twice is rejected (unique constraint)",
      realLike.ok && !duplicateLike.ok,
      `status ${duplicateLike.status}`
    );

    if (hasDistinctOwner) {
      const otherDeletesLike = await del(ownerToken, `/buzz_likes?post_id=eq.${likePostId}&user_id=eq.${strangerUid}`);
      const likeStillExists = await get(adminToken, `/buzz_likes?post_id=eq.${likePostId}&user_id=eq.${strangerUid}&select=id`);
      check("a different user cannot delete someone else's like", likeStillExists.body?.length === 1, JSON.stringify(likeStillExists.body));
    } else {
      skip("a different user cannot delete someone else's like", "owner account not confirmed -- no second distinct identity available");
    }

    // Suspend enforcement, extended to likes (same as reactions before them).
    await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: true });
    const suspendedLikeAttempt = await post(strangerToken, "/buzz_likes", { post_id: likePostId, user_id: strangerUid });
    check("a suspended account's existing session cannot like a post", !suspendedLikeAttempt.ok, `status ${suspendedLikeAttempt.status}`);
    await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: false });

    // Cleanup.
    await del(adminToken, `/buzz_likes?post_id=eq.${likePostId}`);
    if (likePostId) await del(adminToken, `/buzz_posts?id=eq.${likePostId}`);
  }

  // =====================================================================
  // Hot feed ranking (Buzz v2)
  // =====================================================================
  section("buzz: hot feed (Buzz v2)");
  {
    const anonHot = await rpc(null, "get_hot_buzz_posts", { p_limit: 5 });
    check("anon can call get_hot_buzz_posts (public feed sort)", anonHot.ok, `status ${anonHot.status}`);

    const hotPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Buzz Audit] Hot feed test post" },
      "return=representation"
    );
    const hotPostId = hotPost.body?.[0]?.id;
    await post(strangerToken, "/buzz_likes", { post_id: hotPostId, user_id: strangerUid });

    const hotResult = await rpc(adminToken, "get_hot_buzz_posts", { p_limit: 50 });
    const foundInHot = (hotResult.body ?? []).find((row) => row.id === hotPostId);
    check(
      "a liked post appears in get_hot_buzz_posts with a positive hot_score",
      hotResult.ok && !!foundInHot && foundInHot.hot_score > 0,
      JSON.stringify(foundInHot)
    );

    // Cleanup.
    await del(adminToken, `/buzz_likes?post_id=eq.${hotPostId}`);
    if (hotPostId) await del(adminToken, `/buzz_posts?id=eq.${hotPostId}`);
  }

  // =====================================================================
  // Report system (Buzz v2)
  // =====================================================================
  section("buzz: reports (Buzz v2)");
  {
    const reportTestPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Buzz Audit] Report test post" },
      "return=representation"
    );
    const reportTestPostId = reportTestPost.body?.[0]?.id;

    const anonReport = await post(null, "/buzz_reports", { reporter_id: strangerUid, post_id: reportTestPostId, reason: "spam" });
    check("anon cannot insert a report", !anonReport.ok, `status ${anonReport.status}`);

    const bothTargets = await post(strangerToken, "/buzz_reports", {
      reporter_id: strangerUid,
      post_id: reportTestPostId,
      reply_id: reportTestPostId,
      reason: "spam",
    });
    check("a report with both post_id and reply_id is rejected (CHECK constraint)", !bothTargets.ok, `status ${bothTargets.status}`);

    const neitherTarget = await post(
      strangerToken,
      "/buzz_reports",
      { reporter_id: strangerUid, reason: "spam" },
      "return=representation"
    );
    check("a report with neither post_id nor reply_id is rejected (RLS insert check)", !neitherTarget.ok, `status ${neitherTarget.status}`);
    // Defensive cleanup: if this regresses and the insert unexpectedly
    // succeeds again, don't leave a stray row sitting in the live
    // moderation queue the way one already did once (caught by
    // inspection, not by this script -- there's no delete path for
    // buzz_reports at all by design, so "dismiss" is the only available
    // cleanup, same as a real moderator would do).
    const strayReportId = neitherTarget.body?.[0]?.id;
    if (strayReportId) await rpc(adminToken, "resolve_buzz_report", { p_report_id: strayReportId, p_action: "dismiss" });

    const realReport = await post(
      strangerToken,
      "/buzz_reports",
      { reporter_id: strangerUid, post_id: reportTestPostId, reason: "spam" },
      "return=representation"
    );
    check("stranger can report a post", realReport.ok, JSON.stringify(realReport.body));
    const reportId = realReport.body?.[0]?.id;

    const duplicateReport = await post(strangerToken, "/buzz_reports", {
      reporter_id: strangerUid,
      post_id: reportTestPostId,
      reason: "harassment",
    });
    check(
      "the same user reporting the same post twice is rejected (unique constraint)",
      !duplicateReport.ok,
      `status ${duplicateReport.status}`
    );

    const spoofReporter = await post(strangerToken, "/buzz_reports", {
      reporter_id: admin.user.id,
      post_id: reportTestPostId,
      reason: "spam",
    });
    check("stranger cannot spoof reporter_id on a report", !spoofReporter.ok, `status ${spoofReporter.status}`);

    const reporterReadsOwn = await get(strangerToken, `/buzz_reports?id=eq.${reportId}&select=id`);
    check("the reporter CAN read their own report", reporterReadsOwn.body?.length === 1, JSON.stringify(reporterReadsOwn.body));

    if (hasDistinctOwner) {
      const otherReadsReport = await get(ownerToken, `/buzz_reports?id=eq.${reportId}&select=id`);
      check("a different non-admin cannot read someone else's report", (otherReadsReport.body ?? []).length === 0, JSON.stringify(otherReadsReport.body));
    } else {
      skip("a different non-admin cannot read someone else's report", "owner account not confirmed -- no second distinct identity available");
    }

    const adminReadsReport = await get(adminToken, `/buzz_reports?id=eq.${reportId}&select=id,status`);
    check("admin (moderate_buzz) CAN read the report", adminReadsReport.body?.length === 1, JSON.stringify(adminReadsReport.body));

    const strangerResolves = await rpc(strangerToken, "resolve_buzz_report", { p_report_id: reportId, p_action: "dismiss" });
    check("non-admin cannot call resolve_buzz_report", !strangerResolves.ok, JSON.stringify(strangerResolves.body));

    const badAction = await rpc(adminToken, "resolve_buzz_report", { p_report_id: reportId, p_action: "not_a_real_action" });
    check("resolve_buzz_report rejects an unknown action", !badAction.ok, JSON.stringify(badAction.body));

    const dismissResult = await rpc(adminToken, "resolve_buzz_report", { p_report_id: reportId, p_action: "dismiss" });
    const afterDismiss = await get(adminToken, `/buzz_reports?id=eq.${reportId}&select=status`);
    check(
      "admin CAN dismiss a report, and its status becomes 'dismissed'",
      dismissResult.ok && afterDismiss.body?.[0]?.status === "dismissed",
      JSON.stringify(afterDismiss.body)
    );

    // A second report, resolved via "delete" -- confirms the RPC is
    // atomic: the reported post is actually gone AND the report itself
    // is marked 'reviewed', not left half-resolved either way.
    const deleteTestPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Buzz Audit] Report-delete test post" },
      "return=representation"
    );
    const deleteTestPostId = deleteTestPost.body?.[0]?.id;
    const secondReport = await post(
      strangerToken,
      "/buzz_reports",
      { reporter_id: strangerUid, post_id: deleteTestPostId, reason: "harassment" },
      "return=representation"
    );
    const secondReportId = secondReport.body?.[0]?.id;

    const deleteResult = await rpc(adminToken, "resolve_buzz_report", { p_report_id: secondReportId, p_action: "delete" });
    const postAfterResolve = await get(adminToken, `/buzz_posts?id=eq.${deleteTestPostId}&select=id`);
    const reportAfterResolve = await get(adminToken, `/buzz_reports?id=eq.${secondReportId}&select=status`);
    check(
      "admin CAN resolve a report with 'delete' -- the post is gone and the report is 'reviewed'",
      deleteResult.ok && (postAfterResolve.body ?? []).length === 0 && reportAfterResolve.body?.[0]?.status === "reviewed",
      JSON.stringify({ post: postAfterResolve.body, report: reportAfterResolve.body })
    );

    // Suspend enforcement, extended to reports.
    await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: true });
    const suspendedReportAttempt = await post(strangerToken, "/buzz_reports", {
      reporter_id: strangerUid,
      post_id: reportTestPostId,
      reason: "other",
    });
    check("a suspended account's existing session cannot file a report", !suspendedReportAttempt.ok, `status ${suspendedReportAttempt.status}`);
    await rpc(adminToken, "set_user_suspended", { p_user_id: strangerUid, p_suspended: false });

    // Cleanup (deleteTestPost/secondReport already resolved away above).
    await del(adminToken, `/buzz_reports?id=eq.${reportId}`);
    if (reportTestPostId) await del(adminToken, `/buzz_posts?id=eq.${reportTestPostId}`);
  }

  // =====================================================================
  // Server-side post rate limiting (Buzz v2) -- posts only, not replies.
  // =====================================================================
  section("buzz: rate limiting (Buzz v2)");
  {
    const rateLimitPostIds = [];
    let hitLimitEarly = false;
    for (let i = 0; i < 10; i++) {
      const created = await post(
        strangerToken,
        "/buzz_posts",
        { author_id: strangerUid, content: `[Buzz Audit] Rate limit test post ${i}` },
        "return=representation"
      );
      if (created.ok) {
        rateLimitPostIds.push(created.body?.[0]?.id);
      } else {
        hitLimitEarly = true;
      }
    }
    check(
      "10 posts within an hour are all accepted (at the limit, not over it)",
      rateLimitPostIds.length === 10 && !hitLimitEarly,
      `created ${rateLimitPostIds.length}/10`
    );

    const eleventhPost = await post(strangerToken, "/buzz_posts", {
      author_id: strangerUid,
      content: "[Buzz Audit] Rate limit test post 11 -- should be rejected",
    });
    check("an 11th post within the same hour is rejected (rate limit trigger)", !eleventhPost.ok, `status ${eleventhPost.status}`);

    // Replies are explicitly NOT rate-limited -- a reply on one of the 10
    // posts above must still succeed even though the author is at the
    // post limit.
    const replyDespiteLimit = await post(strangerToken, "/buzz_replies", {
      post_id: rateLimitPostIds[0],
      author_id: strangerUid,
      content: "Replies aren't rate-limited",
    });
    check("replies are not subject to the post rate limit", replyDespiteLimit.ok, JSON.stringify(replyDespiteLimit.body));

    // Cleanup -- delete every test post created in this section so the
    // next section (and any real usage) starts from a clean rolling
    // window again (deleted rows don't count toward the trigger's count).
    for (const id of rateLimitPostIds) {
      if (id) await del(adminToken, `/buzz_posts?id=eq.${id}`);
    }
  }

  // =====================================================================
  // Feed-only redirect (Session B) -- /buzz/[id] no longer exists as a
  // page; it 307s into /buzz?post={id} instead of 404ing, so an old
  // shared/bookmarked link still lands somewhere real. This is a plain
  // Next.js route redirect, not a Supabase-enforced check, so it's only
  // testable when the app's own server is reachable (same caveat as the
  // submission-notify endpoint check at the end of this script).
  // =====================================================================
  section("buzz: feed-only redirect (Session B)");
  {
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    try {
      const res = await fetch(`${appUrl}/buzz/00000000-0000-0000-0000-000000000000`, { redirect: "manual" });
      const isRedirect = res.status >= 300 && res.status < 400;
      const location = res.headers.get("location") ?? "";
      check(
        "/buzz/[id] redirects into the feed instead of 404ing",
        isRedirect && location.includes("/buzz?post="),
        `status ${res.status}, location ${location}`
      );
    } catch {
      skip("/buzz/[id] redirects into the feed instead of 404ing", `couldn't reach ${appUrl} -- is the app running?`);
    }
  }

  // =====================================================================
  // View counts (Buzz v2.5)
  // =====================================================================
  section("buzz: view counts (Buzz v2.5)");
  {
    const viewTestPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Buzz Audit] View count test post" },
      "return=representation"
    );
    const viewTestPostId = viewTestPost.body?.[0]?.id;

    const anonView = await rpc(null, "increment_buzz_view", { p_post_id: viewTestPostId });
    check("anon can call increment_buzz_view", anonView.ok, `status ${anonView.status}`);

    const countAfterAnonView = await get(adminToken, `/buzz_posts?id=eq.${viewTestPostId}&select=view_count`);
    check(
      "view_count is 1 after a single anon view",
      countAfterAnonView.body?.[0]?.view_count === 1,
      JSON.stringify(countAfterAnonView.body)
    );

    const ownerView = await rpc(hasDistinctOwner ? ownerToken : strangerToken, "increment_buzz_view", { p_post_id: viewTestPostId });
    check("an authenticated user can call increment_buzz_view", ownerView.ok, `status ${ownerView.status}`);

    const countAfterSecondView = await get(adminToken, `/buzz_posts?id=eq.${viewTestPostId}&select=view_count`);
    check(
      "view_count accumulates across repeated calls rather than capping at 1",
      countAfterSecondView.body?.[0]?.view_count === 2,
      JSON.stringify(countAfterSecondView.body)
    );

    // No separate views table by design -- there is nothing to assert
    // about "who viewed", only the aggregate count on buzz_posts itself.

    // Cleanup.
    if (viewTestPostId) await del(adminToken, `/buzz_posts?id=eq.${viewTestPostId}`);
  }

  // =====================================================================
  // buzz_replies.gif_url (Session 21 Part 2b -- GIF replies via Klipy)
  // =====================================================================
  section("buzz: GIF replies (Session 21)");
  {
    const gifTestPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Buzz Audit] GIF reply test post" },
      "return=representation"
    );
    const gifTestPostId = gifTestPost.body?.[0]?.id;

    const validGifReply = await post(
      strangerToken,
      "/buzz_replies",
      { post_id: gifTestPostId, author_id: strangerUid, content: "", gif_url: "https://media.klipy.com/example.gif" },
      "return=representation"
    );
    check(
      "a reply with an https gif_url and empty content is accepted",
      validGifReply.ok && validGifReply.body?.[0]?.gif_url === "https://media.klipy.com/example.gif",
      JSON.stringify(validGifReply.body)
    );
    const gifReplyId = validGifReply.body?.[0]?.id;

    const nonHttpsGif = await post(strangerToken, "/buzz_replies", {
      post_id: gifTestPostId,
      author_id: strangerUid,
      content: "",
      gif_url: "javascript:alert(1)",
    });
    check("a non-https gif_url is rejected (CHECK constraint)", !nonHttpsGif.ok, `status ${nonHttpsGif.status}`);

    const bothTextAndGif = await post(strangerToken, "/buzz_replies", {
      post_id: gifTestPostId,
      author_id: strangerUid,
      content: "text alongside a gif, should fail",
      gif_url: "https://media.klipy.com/example.gif",
    });
    check(
      "a reply can't have both text content and a gif_url (CHECK constraint)",
      !bothTextAndGif.ok,
      `status ${bothTextAndGif.status}`
    );

    const neitherTextNorGif = await post(strangerToken, "/buzz_replies", {
      post_id: gifTestPostId,
      author_id: strangerUid,
      content: "",
    });
    check(
      "a reply with neither text nor a gif is rejected (CHECK constraint)",
      !neitherTextNorGif.ok,
      `status ${neitherTextNorGif.status}`
    );

    // Cleanup.
    if (gifReplyId) await del(adminToken, `/buzz_replies?id=eq.${gifReplyId}`);
    if (gifTestPostId) await del(adminToken, `/buzz_posts?id=eq.${gifTestPostId}`);
  }

  // =====================================================================
  // notifications (platform-wide notification system)
  // =====================================================================
  section("notifications");
  {
    // RLS filtering a SELECT to zero rows is still a 200 with an empty
    // body, not an error status -- same reasoning as the existing "a
    // different non-admin cannot read someone else's report" check.
    const anonReadsNotifications = await get(null, "/notifications?select=id&limit=1");
    check(
      "anon cannot read notifications",
      anonReadsNotifications.ok && (anonReadsNotifications.body ?? []).length === 0,
      `status ${anonReadsNotifications.status}, body ${JSON.stringify(anonReadsNotifications.body)}`
    );

    const strangerOwnNotifications = await get(strangerToken, "/notifications?select=id&limit=1");
    check(
      "stranger can read their own notifications (e.g. their welcome notification)",
      strangerOwnNotifications.ok,
      `status ${strangerOwnNotifications.status}`
    );

    const directInsertAttempt = await post(strangerToken, "/notifications", {
      recipient_id: strangerUid,
      type: "welcome",
      title: "Fake client-inserted notification",
    });
    check(
      "no client (not even the recipient) can insert a notification directly -- only triggers can",
      !directInsertAttempt.ok,
      `status ${directInsertAttempt.status}`
    );

    // -------------------------------------------------------------------
    // Trigger A: buzz_reply -> notify post author (and never self-notify)
    // -------------------------------------------------------------------
    const replyNotifyPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Notif Audit] Reply-notification test post" },
      "return=representation"
    );
    const replyNotifyPostId = replyNotifyPost.body?.[0]?.id;

    // Stranger replying to their own post must NOT notify themselves.
    const selfReply = await post(strangerToken, "/buzz_replies", {
      post_id: replyNotifyPostId,
      author_id: strangerUid,
      content: "Replying to my own post",
    });
    await new Promise((r) => setTimeout(r, 300));
    const selfReplyNotifications = await get(
      strangerToken,
      `/notifications?type=eq.buzz_reply&reference_id=eq.${replyNotifyPostId}&select=id`
    );
    check(
      "replying to your own post does not create a self-notification",
      selfReply.ok && (selfReplyNotifications.body ?? []).length === 0,
      JSON.stringify(selfReplyNotifications.body)
    );

    if (hasDistinctOwner) {
      const ownerReply = await post(ownerToken, "/buzz_replies", {
        post_id: replyNotifyPostId,
        author_id: ownerUid,
        content: "A real reply from a different user",
      });
      await new Promise((r) => setTimeout(r, 300));
      const replyNotification = await get(
        strangerToken,
        `/notifications?type=eq.buzz_reply&reference_id=eq.${replyNotifyPostId}&select=id,title,actor_id,is_read`
      );
      check(
        "a reply from a different user DOES notify the post author",
        ownerReply.ok && (replyNotification.body ?? []).some((n) => n.actor_id === ownerUid && !n.is_read),
        JSON.stringify(replyNotification.body)
      );
    } else {
      skip("a reply from a different user DOES notify the post author", "owner account not confirmed -- no second distinct identity available");
    }

    // -------------------------------------------------------------------
    // Trigger B: buzz_like -> notify post author, batched
    // -------------------------------------------------------------------
    const likeNotifyPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Notif Audit] Like-notification test post" },
      "return=representation"
    );
    const likeNotifyPostId = likeNotifyPost.body?.[0]?.id;

    const selfLike = await post(strangerToken, "/buzz_likes", { post_id: likeNotifyPostId, user_id: strangerUid });
    await new Promise((r) => setTimeout(r, 300));
    const selfLikeNotifications = await get(
      strangerToken,
      `/notifications?type=eq.buzz_like&reference_id=eq.${likeNotifyPostId}&select=id`
    );
    check(
      "liking your own post does not create a self-notification",
      selfLike.ok && (selfLikeNotifications.body ?? []).length === 0,
      JSON.stringify(selfLikeNotifications.body)
    );
    await del(adminToken, `/buzz_likes?post_id=eq.${likeNotifyPostId}&user_id=eq.${strangerUid}`);

    if (hasDistinctOwner) {
      await post(ownerToken, "/buzz_likes", { post_id: likeNotifyPostId, user_id: ownerUid });
      await new Promise((r) => setTimeout(r, 300));
      const likeNotification = await get(
        strangerToken,
        `/notifications?type=eq.buzz_like&reference_id=eq.${likeNotifyPostId}&select=id,group_key,group_count`
      );
      const firstLikeRow = likeNotification.body?.[0];
      check(
        "a like from a different user notifies the post author, group_count starts at 1",
        firstLikeRow?.group_key === `buzz_like:${likeNotifyPostId}` && firstLikeRow?.group_count === 1,
        JSON.stringify(likeNotification.body)
      );

      // A second liker within the batching window should update the SAME
      // row (group_count -> 2), not create a second one.
      await post(adminToken, "/buzz_likes", { post_id: likeNotifyPostId, user_id: admin.user.id });
      await new Promise((r) => setTimeout(r, 300));
      const afterSecondLike = await get(
        strangerToken,
        `/notifications?type=eq.buzz_like&reference_id=eq.${likeNotifyPostId}&select=id,group_count`
      );
      check(
        "a second like batches into the same notification (group_count -> 2), not a second row",
        (afterSecondLike.body ?? []).length === 1 && afterSecondLike.body?.[0]?.group_count === 2,
        JSON.stringify(afterSecondLike.body)
      );

      await del(adminToken, `/buzz_likes?post_id=eq.${likeNotifyPostId}`);
    } else {
      skip("a like from a different user notifies the post author, batched", "owner account not confirmed -- no second distinct identity available");
    }

    await del(adminToken, `/buzz_posts?id=eq.${replyNotifyPostId}`);
    await del(adminToken, `/buzz_posts?id=eq.${likeNotifyPostId}`);

    // -------------------------------------------------------------------
    // Trigger C: buzz_pin -> notify post author
    // -------------------------------------------------------------------
    const pinNotifyPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Notif Audit] Pin-notification test post" },
      "return=representation"
    );
    const pinNotifyPostId = pinNotifyPost.body?.[0]?.id;
    await patch(adminToken, `/buzz_posts?id=eq.${pinNotifyPostId}`, { is_pinned: true });
    await new Promise((r) => setTimeout(r, 300));
    const pinNotification = await get(strangerToken, `/notifications?type=eq.buzz_pin&reference_id=eq.${pinNotifyPostId}&select=id,actor_id,title`);
    check(
      "pinning a post notifies its author, with no actor (system notification)",
      (pinNotification.body ?? []).some((n) => n.actor_id === null),
      JSON.stringify(pinNotification.body)
    );
    await del(adminToken, `/buzz_posts?id=eq.${pinNotifyPostId}`);

    // -------------------------------------------------------------------
    // Trigger E: buzz_report -> notify admins with moderate_buzz
    // -------------------------------------------------------------------
    const reportNotifyPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Notif Audit] Report-notification test post" },
      "return=representation"
    );
    const reportNotifyPostId = reportNotifyPost.body?.[0]?.id;
    const reportForNotify = await post(
      strangerToken,
      "/buzz_reports",
      { reporter_id: strangerUid, post_id: reportNotifyPostId, reason: "spam" },
      "return=representation"
    );
    const reportForNotifyId = reportForNotify.body?.[0]?.id;
    await new Promise((r) => setTimeout(r, 300));
    const adminReportNotification = await get(
      adminToken,
      `/notifications?type=eq.admin_report&reference_id=eq.${reportForNotifyId}&select=id,actor_id,title`
    );
    check(
      "a new report notifies the (super) admin, who has moderate_buzz",
      adminReportNotification.ok && (adminReportNotification.body ?? []).some((n) => n.actor_id === strangerUid),
      JSON.stringify(adminReportNotification.body)
    );
    await rpc(adminToken, "resolve_buzz_report", { p_report_id: reportForNotifyId, p_action: "dismiss" });
    await del(adminToken, `/buzz_posts?id=eq.${reportNotifyPostId}`);

    // -------------------------------------------------------------------
    // mark_notification_read / mark_all_notifications_read / unread count
    // -------------------------------------------------------------------
    // A dedicated fresh notification for this check specifically -- every
    // notification created by the trigger tests above already got cleaned
    // up by handle_buzz_post_deleted_cleanup_notifications the moment
    // this script deleted its underlying test post (working as intended,
    // but it means none of those survive to be read here).
    let markReadTestPostId;
    if (hasDistinctOwner) {
      const markReadTestPost = await post(
        strangerToken,
        "/buzz_posts",
        { author_id: strangerUid, content: "[Notif Audit] mark_notification_read test post" },
        "return=representation"
      );
      markReadTestPostId = markReadTestPost.body?.[0]?.id;
      await post(ownerToken, "/buzz_replies", {
        post_id: markReadTestPostId,
        author_id: ownerUid,
        content: "Reply to generate a fresh unread notification",
      });
      await new Promise((r) => setTimeout(r, 300));
    }

    const strangerNotifBefore = await get(strangerToken, `/notifications?recipient_id=eq.${strangerUid}&is_read=eq.false&select=id&limit=1`);
    const someUnreadId = strangerNotifBefore.body?.[0]?.id;

    if (someUnreadId && hasDistinctOwner) {
      const otherMarksRead = await rpc(ownerToken, "mark_notification_read", { p_notification_id: someUnreadId });
      const stillUnread = await get(strangerToken, `/notifications?id=eq.${someUnreadId}&select=is_read`);
      check(
        "a different user calling mark_notification_read on someone else's notification has no effect",
        otherMarksRead.ok && stillUnread.body?.[0]?.is_read === false,
        JSON.stringify(stillUnread.body)
      );
    } else if (!someUnreadId) {
      skip("a different user calling mark_notification_read on someone else's notification has no effect", "no unread notification available to test against");
    } else {
      skip("a different user calling mark_notification_read on someone else's notification has no effect", "owner account not confirmed -- no second distinct identity available");
    }

    if (someUnreadId) {
      const countBefore = await rpc(strangerToken, "get_unread_notifications_count", {});
      const ownMarksRead = await rpc(strangerToken, "mark_notification_read", { p_notification_id: someUnreadId });
      const countAfter = await rpc(strangerToken, "get_unread_notifications_count", {});
      check(
        "the recipient CAN mark their own notification read, and the unread count drops by exactly 1",
        ownMarksRead.ok && typeof countBefore.body === "number" && countAfter.body === countBefore.body - 1,
        `before ${JSON.stringify(countBefore.body)}, after ${JSON.stringify(countAfter.body)}`
      );
    }

    // mark_all_notifications_read must only ever touch the caller's own rows.
    if (hasDistinctOwner) {
      const ownerUnreadBefore = await rpc(ownerToken, "get_unread_notifications_count", {});
      const strangerUnreadBefore = await rpc(strangerToken, "get_unread_notifications_count", {});
      await rpc(ownerToken, "mark_all_notifications_read", {});
      const ownerUnreadAfter = await rpc(ownerToken, "get_unread_notifications_count", {});
      const strangerUnreadAfter = await rpc(strangerToken, "get_unread_notifications_count", {});
      check(
        "mark_all_notifications_read zeroes out the caller's own unread count without touching another user's",
        ownerUnreadAfter.body === 0 && strangerUnreadAfter.body === strangerUnreadBefore.body,
        `owner: ${JSON.stringify(ownerUnreadBefore.body)} -> ${JSON.stringify(ownerUnreadAfter.body)}, stranger untouched: ${JSON.stringify(strangerUnreadBefore.body)} -> ${JSON.stringify(strangerUnreadAfter.body)}`
      );
    } else {
      skip("mark_all_notifications_read zeroes out the caller's own unread count without touching another user's", "owner account not confirmed -- no second distinct identity available");
    }

    // Cleanup -- also cascade-deletes this section's own notification via
    // handle_buzz_post_deleted_cleanup_notifications.
    if (markReadTestPostId) await del(adminToken, `/buzz_posts?id=eq.${markReadTestPostId}`);
  }

  // =====================================================================
  // User profile system (username/bio/contact numbers, anonymous posting)
  // =====================================================================
  section("user profiles");
  {
    const anonPublicProfile = await rpc(null, "get_public_profile", { p_user_id: strangerUid });
    check(
      "anon can call get_public_profile and gets public fields only (no email key at all)",
      anonPublicProfile.ok && anonPublicProfile.body?.[0] && !("email" in anonPublicProfile.body[0]),
      JSON.stringify(anonPublicProfile.body)
    );

    if (hasDistinctOwner) {
      const ownerViewsStranger = await rpc(ownerToken, "get_public_profile", { p_user_id: strangerUid });
      check(
        "a different signed-in user can also read someone else's public profile fields",
        ownerViewsStranger.ok && ownerViewsStranger.body?.[0] !== undefined,
        JSON.stringify(ownerViewsStranger.body)
      );
    } else {
      skip("a different signed-in user can also read someone else's public profile fields", "owner account not confirmed -- no second distinct identity available");
    }

    // Own-row update: username/bio/contact numbers are not privilege-
    // sensitive (unlike role/is_verified/admin_permissions, which have
    // their own revert-on-unauthorized-change triggers), so this is a
    // plain profiles_update_own-gated PATCH, no RPC needed.
    const uniqueUsername = `audit_user_${Date.now()}`.slice(0, 30);
    const selfUpdate = await patch(
      strangerToken,
      `/profiles?id=eq.${strangerUid}`,
      { username: uniqueUsername, bio: "Audit test bio", whatsapp_number: "233246408602", phone_number: "233246408602" },
      "return=representation"
    );
    check(
      "a user can update their own username/bio/contact numbers",
      selfUpdate.ok && selfUpdate.body?.[0]?.username === uniqueUsername,
      JSON.stringify(selfUpdate.body)
    );

    if (hasDistinctOwner) {
      // RLS filtering an UPDATE to zero matching rows is still a 200 with
      // an empty body, not an error status -- same reasoning as every
      // other "a different user cannot touch someone else's row" check
      // in this script (see e.g. the notifications section above).
      const otherUpdatesStranger = await patch(
        ownerToken,
        `/profiles?id=eq.${strangerUid}`,
        { username: "hijacked_username" },
        "return=representation"
      );
      check(
        "a different user cannot update someone else's profile",
        otherUpdatesStranger.ok && (otherUpdatesStranger.body ?? []).length === 0,
        JSON.stringify(otherUpdatesStranger.body)
      );
      const strangerUnchanged = await get(strangerToken, `/profiles?id=eq.${strangerUid}&select=username`);
      check(
        "...and the stranger's username is confirmed unchanged",
        strangerUnchanged.body?.[0]?.username === uniqueUsername,
        JSON.stringify(strangerUnchanged.body)
      );
    } else {
      skip("a different user cannot update someone else's profile", "owner account not confirmed -- no second distinct identity available");
    }

    const tooLongUsername = await patch(strangerToken, `/profiles?id=eq.${strangerUid}`, { username: "x".repeat(31) });
    check("a username over 30 chars is rejected (CHECK constraint)", !tooLongUsername.ok, `status ${tooLongUsername.status}`);

    const badCharsUsername = await patch(strangerToken, `/profiles?id=eq.${strangerUid}`, { username: "bad!name$" });
    check("a username with disallowed characters is rejected (CHECK constraint)", !badCharsUsername.ok, `status ${badCharsUsername.status}`);

    const validUsername = await patch(
      strangerToken,
      `/profiles?id=eq.${strangerUid}`,
      { username: "Valid_Name 2" },
      "return=representation"
    );
    check(
      "a username with letters/numbers/underscore/space is accepted",
      validUsername.ok && validUsername.body?.[0]?.username === "Valid_Name 2",
      JSON.stringify(validUsername.body)
    );

    const tooLongBio = await patch(strangerToken, `/profiles?id=eq.${strangerUid}`, { bio: "x".repeat(151) });
    check("a bio over 150 chars is rejected (CHECK constraint)", !tooLongBio.ok, `status ${tooLongBio.status}`);

    // Restore the stranger's profile to a clean slate for future runs.
    await patch(strangerToken, `/profiles?id=eq.${strangerUid}`, { username: null, bio: null, whatsapp_number: null, phone_number: null });

    // -------------------------------------------------------------------
    // Anonymous posting (Buzz)
    // -------------------------------------------------------------------
    const anonPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Profile Audit] Anonymous post test", is_anonymous: true },
      "return=representation"
    );
    const anonPostRow = anonPost.body?.[0];
    check(
      "an anonymous post's author_name is forced to 'Student' and its avatar color is stripped",
      anonPost.ok && anonPostRow?.author_name === "Student" && anonPostRow?.author_avatar_color === null,
      JSON.stringify(anonPostRow)
    );
    // Option A (documented in the migration and getUserBuzzPosts' own
    // comment): author_id is NOT hidden from the raw API response for an
    // anonymous post -- only the client chooses never to render/link it.
    // This assertion exists to make that simplification explicit and
    // testable, not to claim it's actually private at the database level.
    check(
      "(documenting Option A) an anonymous post's author_id is still present in the raw API response, by design",
      anonPostRow?.author_id === strangerUid,
      JSON.stringify(anonPostRow)
    );

    const anonPostId = anonPostRow?.id;
    const toggleAnonymousAfterCreate = await patch(strangerToken, `/buzz_posts?id=eq.${anonPostId}`, { is_anonymous: false }, "return=representation");
    check(
      "is_anonymous cannot be toggled after a post is created (trigger locks it)",
      toggleAnonymousAfterCreate.ok && toggleAnonymousAfterCreate.body?.[0]?.is_anonymous === true,
      JSON.stringify(toggleAnonymousAfterCreate.body)
    );
    if (anonPostId) await del(adminToken, `/buzz_posts?id=eq.${anonPostId}`);

    // Replies are never anonymous -- always the real author_name/avatar,
    // falling back to 'Student' only when no username is set.
    const replyIdentityPost = await post(
      strangerToken,
      "/buzz_posts",
      { author_id: strangerUid, content: "[Profile Audit] Reply identity test" },
      "return=representation"
    );
    const replyIdentityPostId = replyIdentityPost.body?.[0]?.id;
    const identityReply = await post(
      strangerToken,
      "/buzz_replies",
      { post_id: replyIdentityPostId, author_id: strangerUid, content: "A normal, non-anonymous reply" },
      "return=representation"
    );
    check(
      "a reply always carries the real author_name (never 'anonymous')",
      identityReply.ok && identityReply.body?.[0]?.author_name !== null,
      JSON.stringify(identityReply.body)
    );
    if (replyIdentityPostId) await del(adminToken, `/buzz_posts?id=eq.${replyIdentityPostId}`);
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
    // Deleted immediately, not batched at section end -- nothing later
    // reads this id, and the new market listing rate limit (3/hour for a
    // non-leaving-sale seller) counts currently-existing rows, so freeing
    // this slot keeps the section's remaining stranger-owned inserts
    // comfortably under the cap instead of stacking up against it.
    if (validServiceId) await del(adminToken, `/market_listings?id=eq.${validServiceId}`);

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
    // Same immediate-delete reasoning as validServiceId above.
    if (serviceTypeOffCategoryId) await del(adminToken, `/market_listings?id=eq.${serviceTypeOffCategoryId}`);

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

    // Cleanup (validServiceId/serviceTypeOffCategoryId already deleted above).
    for (const id of [preListingId, postListingId]) {
      if (id) await del(adminToken, `/market_listings?id=eq.${id}`);
    }
    await rpc(strangerToken, "set_leaving_campus_mode", { p_enabled: false, p_leaving_date: null });
  }

  // =====================================================================
  // Market listing rate limiting: prevents one account from posting
  // unlimited listings back to back, with exemptions for admins
  // (vendor onboarding) and Leaving Campus Sale sellers (a real move-out
  // bulk-list is expected to exceed the hourly cap).
  // =====================================================================
  section("market: listing rate limiting");
  {
    // Clean slate -- the previous section's cleanup should already have
    // zeroed the stranger's rolling-hour count, but guard against any
    // leftover from an interrupted prior run the same way other sections do.
    const leftovers = await get(strangerToken, `/market_listings?seller_id=eq.${strangerUid}&select=id`);
    for (const row of leftovers.body ?? []) await del(adminToken, `/market_listings?id=eq.${row.id}`);

    const rateLimitListingIds = [];
    let hitLimitEarly = false;
    for (let i = 0; i < 3; i++) {
      const created = await post(
        strangerToken,
        "/market_listings",
        { seller_id: strangerUid, title: `[Market Audit] Rate limit test ${i}`, price: 10, category: "other", contact: "233200000000" },
        "return=representation"
      );
      if (created.ok) rateLimitListingIds.push(created.body?.[0]?.id);
      else hitLimitEarly = true;
    }
    check(
      "3 listings within an hour are all accepted (at the limit, not over it)",
      rateLimitListingIds.length === 3 && !hitLimitEarly,
      `created ${rateLimitListingIds.length}/3`
    );

    const fourthListing = await post(strangerToken, "/market_listings", {
      seller_id: strangerUid,
      title: "[Market Audit] Rate limit test 4 -- should be rejected",
      price: 10,
      category: "other",
      contact: "233200000000",
    });
    check("a 4th listing within the same hour is rejected (rate limit trigger)", !fourthListing.ok, `status ${fourthListing.status}`);

    // moderate_market admins are exempt entirely -- admin-assisted vendor
    // onboarding needs to create many listings back-to-back.
    const adminListingIds = [];
    for (let i = 0; i < 4; i++) {
      const created = await post(
        adminToken,
        "/market_listings",
        { seller_id: admin.user.id, title: `[Market Audit] Admin bypass test ${i}`, price: 10, category: "other", contact: "233200000000" },
        "return=representation"
      );
      if (created.ok) adminListingIds.push(created.body?.[0]?.id);
    }
    check("an admin (moderate_market) is exempt from the listing rate limit", adminListingIds.length === 4, `created ${adminListingIds.length}/4`);

    // Leaving Campus Sale exemption -- the stranger account is already at
    // its hourly cap from the loop above, so a successful insert here
    // proves the exemption genuinely bypasses the hourly check rather than
    // just resetting the counter.
    await rpc(strangerToken, "set_leaving_campus_mode", { p_enabled: true, p_leaving_date: null });
    const leavingSaleListing = await post(
      strangerToken,
      "/market_listings",
      { seller_id: strangerUid, title: "[Market Audit] Leaving sale bypass test", price: 10, category: "other", contact: "233200000000" },
      "return=representation"
    );
    check(
      "a student in Leaving Campus Sale mode is exempt from the hourly cap",
      leavingSaleListing.ok,
      JSON.stringify(leavingSaleListing.body)
    );
    await rpc(strangerToken, "set_leaving_campus_mode", { p_enabled: false, p_leaving_date: null });

    if (hasDistinctOwner) {
      const ownerUnaffected = await post(
        ownerToken,
        "/market_listings",
        { seller_id: ownerUid, title: "[Market Audit] Owner unaffected by stranger's cap", price: 10, category: "other", contact: "233200000000" },
        "return=representation"
      );
      check("the rate limit is scoped per-seller, not global", ownerUnaffected.ok, JSON.stringify(ownerUnaffected.body));
      if (ownerUnaffected.body?.[0]?.id) await del(adminToken, `/market_listings?id=eq.${ownerUnaffected.body[0].id}`);
    } else {
      skip("the rate limit is scoped per-seller, not global", "owner account not confirmed -- no second distinct identity available");
    }

    // Cleanup.
    for (const id of [...rateLimitListingIds, ...adminListingIds, leavingSaleListing.body?.[0]?.id]) {
      if (id) await del(adminToken, `/market_listings?id=eq.${id}`);
    }
  }

  // =====================================================================
  // Marketplace pre-launch & vendor onboarding (Marketplace Pre-Launch
  // session): pending_launch lifecycle, bulk auto-launch, ownership claims
  // =====================================================================
  section("marketplace pre-launch");
  {
    const configBefore = await get(null, "/app_config?key=eq.marketplace_enabled&select=value");
    const originalEnabled = configBefore.body?.[0]?.value === true;

    // Same "read live value, toggle to the state this block needs, restore
    // exactly at the end" posture the existing toggle_marketplace test
    // above already uses -- never leave the live site's gate flipped.
    if (originalEnabled) {
      await rpc(adminToken, "toggle_marketplace", {});
    }

    const pendingA = await post(
      strangerToken,
      "/market_listings",
      { seller_id: strangerUid, title: "[Market Audit] Pending launch A", price: 10, category: "other", contact: "233200000000" },
      "return=representation"
    );
    check(
      "a new listing auto-gets status='pending_launch' while marketplace_enabled is off",
      pendingA.ok && pendingA.body?.[0]?.status === "pending_launch",
      JSON.stringify(pendingA.body)
    );
    const pendingAId = pendingA.body?.[0]?.id;

    const pendingB = await post(
      strangerToken,
      "/market_listings",
      { seller_id: strangerUid, title: "[Market Audit] Pending launch B", price: 10, category: "other", contact: "233200000000" },
      "return=representation"
    );
    const pendingBId = pendingB.body?.[0]?.id;

    const anonReadsPending = await get(null, `/market_listings?id=eq.${pendingAId}&select=id`);
    check("a pending_launch listing is hidden from anon", (anonReadsPending.body ?? []).length === 0, JSON.stringify(anonReadsPending.body));

    if (hasDistinctOwner) {
      const otherReadsPending = await get(ownerToken, `/market_listings?id=eq.${pendingAId}&select=id`);
      check("a pending_launch listing is hidden from a different signed-in user", (otherReadsPending.body ?? []).length === 0, JSON.stringify(otherReadsPending.body));
    } else {
      skip("a pending_launch listing is hidden from a different signed-in user", "owner account not confirmed -- no second distinct identity available");
    }

    const sellerReadsOwnPending = await get(strangerToken, `/market_listings?id=eq.${pendingAId}&select=id`);
    check("the listing's own seller CAN still see their pending_launch listing", sellerReadsOwnPending.body?.length === 1, JSON.stringify(sellerReadsOwnPending.body));

    const adminReadsPending = await get(adminToken, `/market_listings?id=eq.${pendingAId}&select=id`);
    check("admin CAN see any pending_launch listing", adminReadsPending.body?.length === 1, JSON.stringify(adminReadsPending.body));

    const pendingCount = await rpc(null, "get_pending_launch_count", {});
    check(
      "get_pending_launch_count is anon-callable and counts at least the listings just created",
      pendingCount.ok && typeof pendingCount.body === "number" && pendingCount.body >= 2,
      JSON.stringify(pendingCount.body)
    );

    const sellerJumpsQueue = await patch(
      strangerToken,
      `/market_listings?id=eq.${pendingAId}`,
      { status: "active" },
      "return=representation"
    );
    check(
      "a seller cannot directly flip their own pending_launch listing to active (trigger reverts it)",
      sellerJumpsQueue.body?.[0]?.status === "pending_launch",
      JSON.stringify(sellerJumpsQueue.body)
    );

    const adminDirectLaunch = await patch(
      adminToken,
      `/market_listings?id=eq.${pendingAId}`,
      { status: "active" },
      "return=representation"
    );
    check(
      "admin CAN directly move a single listing from pending_launch to active",
      adminDirectLaunch.body?.[0]?.status === "active",
      JSON.stringify(adminDirectLaunch.body)
    );

    // Bulk auto-launch: flipping marketplace_enabled on should promote
    // every remaining pending_launch listing (pendingB) to active with no
    // seller action, and it should become publicly visible immediately.
    const bulkLaunch = await rpc(adminToken, "toggle_marketplace", {});
    check("toggling marketplace on returns true (now enabled)", bulkLaunch.ok && bulkLaunch.body === true, JSON.stringify(bulkLaunch.body));

    const pendingBAfterLaunch = await get(adminToken, `/market_listings?id=eq.${pendingBId}&select=status`);
    check(
      "toggling marketplace on bulk-promotes every pending_launch listing to active",
      pendingBAfterLaunch.body?.[0]?.status === "active",
      JSON.stringify(pendingBAfterLaunch.body)
    );

    const pendingBAnonAfterLaunch = await get(null, `/market_listings?id=eq.${pendingBId}&select=id`);
    check("a bulk-launched listing is immediately anon-visible", pendingBAnonAfterLaunch.body?.length === 1, JSON.stringify(pendingBAnonAfterLaunch.body));

    // Restore the live flag to exactly what it was before this block ran.
    if (!originalEnabled) {
      await rpc(adminToken, "toggle_marketplace", {});
    }

    for (const id of [pendingAId, pendingBId]) {
      if (id) await del(adminToken, `/market_listings?id=eq.${id}`);
    }
  }

  section("marketplace pre-launch: ownership claims");
  {
    // A normal, already-claimed (is_unclaimed=false by default) listing --
    // used only to prove claims can't be filed against it.
    const claimedListing = await post(
      adminToken,
      "/market_listings",
      { seller_id: admin.user.id, title: "[Market Audit] Normal claimed listing", price: 10, category: "other", contact: "233200000000" },
      "return=representation"
    );
    const claimedListingId = claimedListing.body?.[0]?.id;

    // Admin-assisted vendor onboarding: attributed to the admin's own
    // account until a real student claims it (Part 5/6 of the brief).
    const unclaimedListing = await post(
      adminToken,
      "/market_listings",
      {
        seller_id: admin.user.id,
        title: "[Market Audit] Unclaimed vendor listing",
        price: 15,
        category: "other",
        contact: "233200000000",
        vendor_name: "Audit Vendor",
        vendor_whatsapp: "233200000000",
        is_unclaimed: true,
      },
      "return=representation"
    );
    check(
      "an admin-created listing can be marked is_unclaimed=true with vendor_name/vendor_whatsapp",
      unclaimedListing.ok && unclaimedListing.body?.[0]?.is_unclaimed === true,
      JSON.stringify(unclaimedListing.body)
    );
    const unclaimedListingId = unclaimedListing.body?.[0]?.id;

    const claimOnClaimedListing = await post(strangerToken, "/market_listing_claims", {
      listing_id: claimedListingId,
      claimant_id: strangerUid,
    });
    check("cannot submit a claim on a listing that isn't unclaimed (RLS WITH CHECK)", !claimOnClaimedListing.ok, `status ${claimOnClaimedListing.status}`);

    const spoofClaimant = await post(strangerToken, "/market_listing_claims", {
      listing_id: unclaimedListingId,
      claimant_id: admin.user.id,
    });
    check("cannot spoof claimant_id on a claim (RLS WITH CHECK)", !spoofClaimant.ok, `status ${spoofClaimant.status}`);

    const claim1 = await post(
      strangerToken,
      "/market_listing_claims",
      { listing_id: unclaimedListingId, claimant_id: strangerUid },
      "return=representation"
    );
    check("a claim on an unclaimed listing is accepted, starting as pending", claim1.ok && claim1.body?.[0]?.status === "pending", JSON.stringify(claim1.body));
    const claim1Id = claim1.body?.[0]?.id;

    const duplicateClaim = await post(strangerToken, "/market_listing_claims", {
      listing_id: unclaimedListingId,
      claimant_id: strangerUid,
    });
    check("a second pending claim on the same (listing, claimant) is rejected (unique index)", !duplicateClaim.ok, `status ${duplicateClaim.status}`);

    if (hasDistinctOwner) {
      const otherReadsClaim = await get(ownerToken, `/market_listing_claims?id=eq.${claim1Id}&select=id`);
      check("a different non-admin cannot read someone else's claim", (otherReadsClaim.body ?? []).length === 0, JSON.stringify(otherReadsClaim.body));
    } else {
      skip("a different non-admin cannot read someone else's claim", "owner account not confirmed -- no second distinct identity available");
    }
    const selfReadsClaim = await get(strangerToken, `/market_listing_claims?id=eq.${claim1Id}&select=id`);
    check("the claimant CAN read their own claim", selfReadsClaim.body?.length === 1, JSON.stringify(selfReadsClaim.body));
    const adminReadsClaim = await get(adminToken, `/market_listing_claims?id=eq.${claim1Id}&select=id`);
    check("admin (moderate_market) CAN read any claim", adminReadsClaim.body?.length === 1, JSON.stringify(adminReadsClaim.body));

    const nonAdminResolve = await rpc(strangerToken, "resolve_listing_claim", { p_claim_id: claim1Id, p_action: "approve" });
    check("a non-admin cannot call resolve_listing_claim", !nonAdminResolve.ok, `status ${nonAdminResolve.status}`);

    const badAction = await rpc(adminToken, "resolve_listing_claim", { p_claim_id: claim1Id, p_action: "bogus" });
    check("resolve_listing_claim rejects an unknown action", !badAction.ok, `status ${badAction.status}`);

    const rejectClaim1 = await rpc(adminToken, "resolve_listing_claim", { p_claim_id: claim1Id, p_action: "reject" });
    const claim1AfterReject = await get(adminToken, `/market_listing_claims?id=eq.${claim1Id}&select=status`);
    check(
      "admin CAN reject a claim, and it doesn't transfer ownership",
      rejectClaim1.ok && claim1AfterReject.body?.[0]?.status === "rejected",
      JSON.stringify(claim1AfterReject.body)
    );
    const listingAfterReject = await get(adminToken, `/market_listings?id=eq.${unclaimedListingId}&select=seller_id,is_unclaimed`);
    check(
      "a rejected claim leaves the listing's ownership unchanged",
      listingAfterReject.body?.[0]?.seller_id === admin.user.id && listingAfterReject.body?.[0]?.is_unclaimed === true,
      JSON.stringify(listingAfterReject.body)
    );

    // Rejection frees up the (listing, claimant) pair for a fresh claim --
    // the unique index only ever covers status='pending'.
    const claim2 = await post(
      strangerToken,
      "/market_listing_claims",
      { listing_id: unclaimedListingId, claimant_id: strangerUid },
      "return=representation"
    );
    const claim2Id = claim2.body?.[0]?.id;

    let claim3Id = null;
    if (hasDistinctOwner) {
      const claim3 = await post(
        ownerToken,
        "/market_listing_claims",
        { listing_id: unclaimedListingId, claimant_id: ownerUid },
        "return=representation"
      );
      claim3Id = claim3.body?.[0]?.id;
    }

    const approveClaim2 = await rpc(adminToken, "resolve_listing_claim", { p_claim_id: claim2Id, p_action: "approve" });
    const listingAfterApprove = await get(adminToken, `/market_listings?id=eq.${unclaimedListingId}&select=seller_id,is_unclaimed`);
    check(
      "approving a claim transfers seller_id and clears is_unclaimed",
      approveClaim2.ok && listingAfterApprove.body?.[0]?.seller_id === strangerUid && listingAfterApprove.body?.[0]?.is_unclaimed === false,
      JSON.stringify(listingAfterApprove.body)
    );
    const claim2AfterApprove = await get(adminToken, `/market_listing_claims?id=eq.${claim2Id}&select=status`);
    check("the approved claim's own status becomes 'approved'", claim2AfterApprove.body?.[0]?.status === "approved", JSON.stringify(claim2AfterApprove.body));

    if (hasDistinctOwner && claim3Id) {
      const claim3AfterApprove = await get(adminToken, `/market_listing_claims?id=eq.${claim3Id}&select=status`);
      check(
        "approving one claim auto-rejects any other still-pending claim on the same listing",
        claim3AfterApprove.body?.[0]?.status === "rejected",
        JSON.stringify(claim3AfterApprove.body)
      );
    } else {
      skip("approving one claim auto-rejects any other still-pending claim on the same listing", "owner account not confirmed -- no second distinct identity available");
    }

    const strangerSelfReassign = await patch(
      strangerToken,
      `/market_listings?id=eq.${unclaimedListingId}`,
      { seller_id: admin.user.id },
      "return=representation"
    );
    check(
      "the new owner still cannot reassign seller_id via a direct update (only resolve_listing_claim can)",
      strangerSelfReassign.body?.[0]?.seller_id === strangerUid,
      JSON.stringify(strangerSelfReassign.body)
    );

    // Cleanup (claim rows cascade-delete with their listing).
    for (const id of [claimedListingId, unclaimedListingId]) {
      if (id) await del(adminToken, `/market_listings?id=eq.${id}`);
    }
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
  // Cleanup: the owner's bootstrap test hostel
  // =====================================================================
  // This used to be reused indefinitely across runs ("safe to
  // ignore/delete" was a lie -- nothing ever actually deleted it). That
  // was harmless while this ran against an empty dev database, but once
  // real hostels are live, "[Security Audit] Renamed via pending edit" /
  // "Security Audit Zone" sat in the real public feed between runs,
  // visible to real users, until caught by inspection. Every child row
  // (reviews, saved_hostels) FK-cascades on hostel delete, so this is
  // safe to remove unconditionally now that every section above that
  // depends on ownerHostelId has already run. The next run just creates
  // a fresh one.
  section("Cleanup: the owner's bootstrap test hostel");
  {
    const deleteOwnerHostel = await del(adminToken, `/hostels?id=eq.${ownerHostelId}`);
    check("owner test hostel deleted at the end of the run (no longer left live in the public feed)", deleteOwnerHostel.ok, `status ${deleteOwnerHostel.status}`);
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
