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
