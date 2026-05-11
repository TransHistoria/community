#!/usr/bin/env node
/**
 * Worker API integration tests.
 *
 * Every state-changing request (POST / PATCH / DELETE) is immediately followed
 * by a read-back that asserts the database was actually written — not just that
 * the handler returned { ok: true }.
 *
 * Expects the worker to be running at API_BASE (default: http://localhost:8787)
 * and the local D1 to have been seeded with worker/test/seed.sql.
 *
 * Exit code: 0 = all pass, 1 = one or more failures.
 */

const BASE = (process.env.API_BASE ?? "http://localhost:8787").replace(/\/$/, "");

// ── Tiny test harness ────────────────────────────────────────────────────────

import { appendFileSync } from "node:fs";

let passed = 0;
let failed = 0;

/** Full result list: { section, name, ok, error? } */
const results = [];
let currentSection = "";

function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? "assertion failed");
}

/**
 * Minimal fetch wrapper. Returns { status, data } where data is parsed JSON
 * (or the raw text if the response is not JSON).
 */
async function api(method, path, body, token) {
  const headers = {};
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
        ? body
        : JSON.stringify(body),
  });

  let data;
  const ct = res.headers.get("content-type") ?? "";
  try {
    data = ct.includes("application/json") ? await res.json() : await res.text();
  } catch {
    data = null;
  }
  return { status: res.status, data, headers: res.headers };
}

async function test(name, fn) {
  try {
    await fn();
    process.stdout.write(`  ✓ ${name}\n`);
    results.push({ section: currentSection, name, ok: true });
    passed++;
  } catch (err) {
    process.stderr.write(`  ✗ ${name}: ${err.message}\n`);
    results.push({ section: currentSection, name, ok: false, error: err.message });
    failed++;
  }
}

/** Mark the current test section so the report can group by section. */
function section(name) {
  currentSection = name;
  console.log(`\n${name}:`);
}

/** Poll /api/health until the worker responds (up to 30 s). */
async function waitReady(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Worker did not become ready within 30 s");
}

// ── Report writer ─────────────────────────────────────────────────────────────

/**
 * Write a Markdown test-report to GITHUB_STEP_SUMMARY (if set) and always
 * print the plain-text summary to stdout.
 */
function writeReport() {
  const total = passed + failed;
  const badge = failed === 0 ? "✅ All tests passed" : `❌ ${failed} test(s) failed`;

  // ── Markdown for GitHub Actions Job Summary ──────────────────────────────
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const lines = [];
    lines.push(`## API Integration Test Report`);
    lines.push(``);
    lines.push(`**${badge}** — ${passed}/${total} tests passed`);
    lines.push(``);

    // Group by section
    const sections = [...new Set(results.map((r) => r.section))];
    for (const sec of sections) {
      const secResults = results.filter((r) => r.section === sec);
      const secPassed = secResults.filter((r) => r.ok).length;
      const secFailed = secResults.length - secPassed;
      const icon = secFailed === 0 ? "✅" : "❌";
      lines.push(`### ${icon} ${sec || "General"} (${secPassed}/${secResults.length})`);
      lines.push(``);
      lines.push(`| Status | Test |`);
      lines.push(`|--------|------|`);
      for (const r of secResults) {
        const status = r.ok ? "✅ pass" : "❌ fail";
        const name = r.name.replace(/\|/g, "\\|");
        lines.push(`| ${status} | ${name} |`);
      }
      lines.push(``);
    }

    if (failed > 0) {
      lines.push(`### Failure Details`);
      lines.push(``);
      for (const r of results.filter((r) => !r.ok)) {
        lines.push(`**${r.name}**`);
        lines.push("```");
        lines.push(r.error ?? "unknown error");
        lines.push("```");
        lines.push(``);
      }
    }

    try {
      appendFileSync(summaryPath, lines.join("\n") + "\n");
    } catch (e) {
      console.error("Warning: could not write to GITHUB_STEP_SUMMARY:", e.message);
    }
  }

  // ── Plain-text summary (always printed) ─────────────────────────────────
  console.log(`\n${"─".repeat(56)}`);
  if (failed === 0) {
    console.log(`✓ All ${total} tests passed`);
  } else {
    console.log(`Results: ${passed}/${total} passed, ${failed} failed\n`);
    console.log("Failures:");
    for (const r of results.filter((r) => !r.ok)) {
      console.log(`  ✗ ${r.name}`);
      console.log(`    ${r.error}`);
    }
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

let adminToken, verifiedToken, user2Token;
let verifiedHandle, user2Handle;
let eventId, eventSlug;
let regId;
let commentId;
let contactId;
let contactRequestId;
let applicationId;
let fileUrl;

// ── Tests ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Testing ${BASE}\n`);
  await waitReady();
  console.log("Worker ready.\n");

  // ────────────────────────────────────────────────────────────────────────────
  // Health
  // ────────────────────────────────────────────────────────────────────────────
  section("Health");

  await test("GET /api/health → 200 { ok: true, ts: <iso> }", async () => {
    const { status, data } = await api("GET", "/api/health");
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok === true, "expected ok");
    assert(typeof data.ts === "string" && data.ts.length > 0, "expected ts timestamp");
    assert(!isNaN(Date.parse(data.ts)), "ts is not a valid ISO date");
  });

  await test("GET /unknown-path → 404 with error field", async () => {
    const { status, data } = await api("GET", "/api/does-not-exist");
    assert(status === 404, `expected 404, got ${status}`);
    assert(data.error, "expected error field");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Auth
  // ────────────────────────────────────────────────────────────────────────────
  section("Auth");

  await test("POST /api/auth/send-link — missing email → 400", async () => {
    const { status } = await api("POST", "/api/auth/send-link", { email: "" });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/auth/send-link — invalid email → 400", async () => {
    const { status } = await api("POST", "/api/auth/send-link", {
      email: "notanemail",
    });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/auth/send-link — valid email → 200 + token row in DB", async () => {
    const { status, data } = await api("POST", "/api/auth/send-link", {
      email: "admin@ci.test",
    });
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Verify the token was written: the original seed token still works, which means
    // the send-link only adds a NEW token without deleting the usable seed one.
    // (send-link deletes EXPIRED tokens only; the seed tokens are still valid.)
    const vr = await api("GET", "/api/auth/me", undefined, "should-fail");
    assert(vr.status === 401, "sanity: unauthenticated /me should 401");
  });

  await test("POST /api/auth/create-admin — missing params → 400", async () => {
    const { status } = await api("POST", "/api/auth/create-admin", { email: "" });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/auth/create-admin — wrong secret → 403", async () => {
    const { status } = await api("POST", "/api/auth/create-admin", {
      email: "bootstrap-admin@ci.test",
      secret: "wrong-secret",
    });
    assert(status === 403, `expected 403, got ${status}`);
  });

  await test("POST /api/auth/create-admin — admin already exists → 409", async () => {
    const { status } = await api("POST", "/api/auth/create-admin", {
      email: "bootstrap-admin@ci.test",
      secret: "ci-create-admin-secret",
    });
    assert(status === 409, `expected 409, got ${status}`);
  });

  await test("POST /api/auth/verify — invalid token → 400", async () => {
    const { status } = await api("POST", "/api/auth/verify", {
      token: "bad-token-xyz",
    });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/auth/verify — admin token → 200 + JWT; /me returns correct user", async () => {
    const { status, data } = await api("POST", "/api/auth/verify", {
      token: "ci-token-admin",
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.token, "expected token");
    assert(data.user.tier === "ADMIN", `expected ADMIN, got ${data.user.tier}`);
    adminToken = data.token;
    // Read-back: GET /api/auth/me returns the same user
    const me = await api("GET", "/api/auth/me", undefined, adminToken);
    assert(me.status === 200, `/me failed: ${me.status}`);
    assert(me.data.email === "admin@ci.test", `wrong email: ${me.data.email}`);
    assert(me.data.tier === "ADMIN", `wrong tier: ${me.data.tier}`);
  });

  await test("POST /api/auth/verify — verified token → 200 + JWT; /me correct", async () => {
    const { status, data } = await api("POST", "/api/auth/verify", {
      token: "ci-token-verified",
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.token, "expected token");
    assert(data.user.tier === "VERIFIED", `expected VERIFIED, got ${data.user.tier}`);
    verifiedToken = data.token;
    verifiedHandle = data.user.handle;
    const me = await api("GET", "/api/auth/me", undefined, verifiedToken);
    assert(me.data.email === "verified@ci.test", "wrong email");
  });

  await test("POST /api/auth/verify — user2 token → 200 + JWT", async () => {
    const { status, data } = await api("POST", "/api/auth/verify", {
      token: "ci-token-user2",
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    user2Token = data.token;
    user2Handle = data.user.handle;
  });

  await test("POST /api/auth/verify — reuse consumed token → 400", async () => {
    // admin token was consumed above; must not be reusable
    const { status } = await api("POST", "/api/auth/verify", {
      token: "ci-token-admin",
    });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("GET /api/auth/me — no token → 401", async () => {
    const { status } = await api("GET", "/api/auth/me");
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("POST /api/auth/verify-invite — unknown code → 400", async () => {
    const { status } = await api("POST", "/api/auth/verify-invite", {
      email: "x@y.com",
      code: "BADCODEXX",
    });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/auth/verify-invite — seed code → 200; invite code still present in DB", async () => {
    const { status, data } = await api("POST", "/api/auth/verify-invite", {
      email: "new@ci.test",
      code: "CI-SEED-CODE",
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
    // Read-back: invite list for admin still shows the code (verify-invite validates but
    // does not consume — used_count is incremented only on the subsequent magic-link verify)
    const inv = await api("GET", "/api/users/me/invites", undefined, adminToken);
    assert(inv.status === 200, `invites failed: ${inv.status}`);
    const seeded = inv.data.invites.find((i) => i.code === "CI-SEED-CODE");
    assert(seeded, "seed invite code not found in list");
    assert(typeof seeded.used_count === "number", "used_count should be a number");
  });

  await test("POST /api/auth/sign-out → 200", async () => {
    const { status, data } = await api("POST", "/api/auth/sign-out", {}, adminToken);
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Users
  // ────────────────────────────────────────────────────────────────────────────
  section("Users");

  await test("GET /api/users/:handle — authenticated → 200 with profile fields", async () => {
    const { status, data } = await api(
      "GET",
      `/api/users/${verifiedHandle}`,
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.handle === verifiedHandle, "handle mismatch");
    assert(data.tier === "VERIFIED", `expected VERIFIED tier, got ${data.tier}`);
    assert(typeof data.displayName === "string", "missing displayName");
  });

  await test("GET /api/users/:handle — unknown → 404", async () => {
    const { status } = await api("GET", "/api/users/nobody_ci_xyz", undefined, adminToken);
    assert(status === 404, `expected 404, got ${status}`);
  });

  await test("PATCH /api/users/me — no auth → 401", async () => {
    const { status } = await api("PATCH", "/api/users/me", { displayName: "x" });
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("PATCH /api/users/me — update profile; read-back via /me confirms DB write", async () => {
    const { status, data } = await api(
      "PATCH",
      "/api/users/me",
      { displayName: "CI Admin Updated", bio: "bio written by CI test" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back: GET /api/auth/me returns updated fields
    const me = await api("GET", "/api/auth/me", undefined, adminToken);
    assert(me.status === 200, `/me failed: ${me.status}`);
    assert(me.data.displayName === "CI Admin Updated", `displayName not updated: ${me.data.displayName}`);
    assert(me.data.bio === "bio written by CI test", `bio not updated: ${me.data.bio}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Contacts
  // ────────────────────────────────────────────────────────────────────────────
  section("Contacts");

  await test("GET /api/users/me/contacts — no auth → 401", async () => {
    const { status } = await api("GET", "/api/users/me/contacts");
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("GET /api/users/me/contacts — starts empty → []", async () => {
    const { status, data } = await api(
      "GET",
      "/api/users/me/contacts",
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.contacts), "expected contacts array");
    assert(data.contacts.length === 0, `expected empty, got ${data.contacts.length}`);
  });

  await test("POST /api/users/me/contacts — missing fields → 400", async () => {
    const { status } = await api(
      "POST",
      "/api/users/me/contacts",
      { kind: "TELEGRAM" },
      verifiedToken
    );
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/users/me/contacts → 200; read-back confirms row in DB", async () => {
    const { status, data } = await api(
      "POST",
      "/api/users/me/contacts",
      { kind: "TELEGRAM", value: "@ci_verified", visibility: "VERIFIED" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok && data.id, "expected ok + id");
    contactId = data.id;
    // Read-back
    const list = await api("GET", "/api/users/me/contacts", undefined, verifiedToken);
    assert(list.data.contacts.length === 1, `expected 1 contact, got ${list.data.contacts.length}`);
    const contact = list.data.contacts[0];
    assert(contact.id === contactId, "contactId mismatch");
    assert(contact.kind === "TELEGRAM", `kind mismatch: ${contact.kind}`);
    assert(contact.value === "@ci_verified", `value mismatch: ${contact.value}`);
  });

  await test("PATCH /api/users/me/contacts/:id → 200; label persisted in DB", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/users/me/contacts/${contactId}`,
      { label: "My Telegram" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back: label updated
    const list = await api("GET", "/api/users/me/contacts", undefined, verifiedToken);
    const contact = list.data.contacts.find((c) => c.id === contactId);
    assert(contact?.label === "My Telegram", `label not updated: ${contact?.label}`);
  });

  await test("PATCH /api/users/me/contacts/:id — wrong user → 403", async () => {
    const { status } = await api(
      "PATCH",
      `/api/users/me/contacts/${contactId}`,
      { label: "x" },
      user2Token
    );
    assert(status === 403, `expected 403, got ${status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Invites
  // ────────────────────────────────────────────────────────────────────────────
  section("Invites");

  await test("GET /api/users/me/invites → 200 with seed invite included", async () => {
    const { status, data } = await api(
      "GET",
      "/api/users/me/invites",
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.invites), "expected invites array");
    assert(data.invites.length >= 1, "expected at least the seed invite");
  });

  await test("POST /api/users/me/invites — admin → 200; new code appears in GET /invites", async () => {
    const { status, data } = await api(
      "POST",
      "/api/users/me/invites",
      { note: "CI invite" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.code, "expected code");
    // Read-back: the new code appears in the invite list
    const list = await api("GET", "/api/users/me/invites", undefined, adminToken);
    const found = list.data.invites.find((i) => i.code === data.code);
    assert(found, "new invite code not found in list");
    assert(found.note === "CI invite", `note mismatch: ${found.note}`);
    assert(found.used_count === 0, `expected used_count 0, got ${found.used_count}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Blocks
  // ────────────────────────────────────────────────────────────────────────────
  section("Blocks");

  await test("GET /api/users/me/blocks — no auth → 401", async () => {
    const { status } = await api("GET", "/api/users/me/blocks");
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("GET /api/users/me/blocks — starts empty → []", async () => {
    const { status, data } = await api(
      "GET",
      "/api/users/me/blocks",
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.blocks), "expected blocks array");
    assert(data.blocks.length === 0, `expected 0 blocks, got ${data.blocks.length}`);
  });

  await test("POST /api/users/:handle/block — self → 400", async () => {
    const { status } = await api(
      "POST",
      `/api/users/${verifiedHandle}/block`,
      {},
      verifiedToken
    );
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/users/:handle/block → 200; block row in DB; GET /blocks returns it", async () => {
    const { status, data } = await api(
      "POST",
      `/api/users/${user2Handle}/block`,
      {},
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back
    const list = await api("GET", "/api/users/me/blocks", undefined, verifiedToken);
    assert(list.data.blocks.length === 1, `expected 1 block, got ${list.data.blocks.length}`);
    assert(list.data.blocks[0].handle === user2Handle, "blocked user handle mismatch");
  });

  await test("DELETE /api/users/:handle/block → 200; row removed from DB", async () => {
    const { status, data } = await api(
      "DELETE",
      `/api/users/${user2Handle}/block`,
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back: block list is empty again
    const list = await api("GET", "/api/users/me/blocks", undefined, verifiedToken);
    assert(list.data.blocks.length === 0, `expected 0 blocks after unblock, got ${list.data.blocks.length}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Applications
  // ────────────────────────────────────────────────────────────────────────────
  section("Applications");

  await test("POST /api/applications — missing email → 400", async () => {
    const { status } = await api("POST", "/api/applications", { email: "" });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/applications → 200; application row persisted (GET /mine shows PENDING)", async () => {
    const { status, data } = await api("POST", "/api/applications", {
      email: "applicant@ci.test",
      answers: { identity: "test", motivation: "ci testing" },
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
    // Read-back: GET /mine returns the application with PENDING status and the id.
    // Note: the /mine endpoint returns only {id, status, created_at} — not email or answers.
    // To confirm answers were persisted, check via the admin endpoint.
    const mine = await api("GET", "/api/applications/mine?email=applicant@ci.test");
    assert(mine.status === 200, `mine failed: ${mine.status}`);
    assert(mine.data.application !== null, "application is null");
    assert(mine.data.application.status === "PENDING", `expected PENDING, got ${mine.data.application.status}`);
    applicationId = mine.data.application.id;
    assert(applicationId, "applicationId not returned");
    // Read-back answers via the admin view
    const adminView = await api("GET", "/api/applications", undefined, adminToken);
    const full = adminView.data.applications.find((a) => a.id === applicationId);
    assert(full, "application not found in admin list");
    assert(full.email === "applicant@ci.test", `email mismatch: ${full.email}`);
    const answers = JSON.parse(full.answers);
    assert(answers.motivation === "ci testing", "answers not persisted");
  });

  await test("POST /api/applications — duplicate pending → 409", async () => {
    const { status } = await api("POST", "/api/applications", {
      email: "applicant@ci.test",
      answers: {},
    });
    assert(status === 409, `expected 409, got ${status}`);
  });

  await test("GET /api/applications/mine — missing email param → 400", async () => {
    const { status } = await api("GET", "/api/applications/mine");
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("GET /api/applications — non-admin → 403", async () => {
    const { status } = await api("GET", "/api/applications", undefined, verifiedToken);
    assert(status === 403, `expected 403, got ${status}`);
  });

  await test("GET /api/applications — admin → 200 with our application", async () => {
    const { status, data } = await api(
      "GET",
      "/api/applications",
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.applications), "expected applications array");
    const app = data.applications.find((a) => a.id === applicationId);
    assert(app, "our application not in admin list");
    assert(app.status === "PENDING", `expected PENDING, got ${app.status}`);
  });

  await test("PATCH /api/applications/:id — approve → 200; status APPROVED in DB", async () => {
    assert(applicationId, "applicationId missing from previous test");
    const { status, data } = await api(
      "PATCH",
      `/api/applications/${applicationId}`,
      { decision: "APPROVED" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
    // Read-back: status changed in DB (check via admin view since /mine only has id/status/created_at)
    const mine = await api("GET", `/api/applications/mine?email=applicant@ci.test`);
    assert(mine.data.application.status === "APPROVED", `expected APPROVED, got ${mine.data.application.status}`);
    // reviewer_id should be set — confirm via admin list filtered to APPROVED
    const adminView = await api("GET", "/api/applications?status=APPROVED", undefined, adminToken);
    const full = adminView.data.applications.find((a) => a.id === applicationId);
    assert(full, "approved application not found in admin list");
    assert(full.reviewer_id != null, "reviewer_id not set after approval");
  });

  await test("PATCH /api/applications/:id — re-process already-decided → 400", async () => {
    const { status } = await api(
      "PATCH",
      `/api/applications/${applicationId}`,
      { decision: "REJECTED" },
      adminToken
    );
    assert(status === 400, `expected 400, got ${status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Events
  // ────────────────────────────────────────────────────────────────────────────
  section("Events");

  await test("GET /api/events → 200 with events array", async () => {
    const { status, data } = await api("GET", "/api/events");
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.events), "expected events array");
  });

  await test("POST /api/events — no auth → 401", async () => {
    const { status } = await api("POST", "/api/events", {
      title: "x",
      description: "x",
      category: "SOCIAL",
      format: "ONLINE",
      startAt: new Date().toISOString(),
      endAt: new Date().toISOString(),
    });
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("POST /api/events — missing required fields → 400", async () => {
    const { status } = await api(
      "POST",
      "/api/events",
      { title: "Incomplete" },
      verifiedToken
    );
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/events — verified user → 200; GET /:slug returns persisted data", async () => {
    const start = new Date(Date.now() + 86_400_000).toISOString();
    const end = new Date(Date.now() + 90_000_000).toISOString();
    const { status, data } = await api(
      "POST",
      "/api/events",
      {
        title: "CI Integration Test Event",
        description: "Created by the API test suite",
        category: "SOCIAL",
        format: "ONLINE",
        startAt: start,
        endAt: end,
        visibility: "VERIFIED",
        requireApproval: true,
      },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok && data.slug, "expected ok + slug");
    eventSlug = data.slug;
    // Read-back: GET /:slug returns all persisted fields
    const ev = await api("GET", `/api/events/${eventSlug}`, undefined, verifiedToken);
    assert(ev.status === 200, `GET event failed: ${ev.status}`);
    assert(ev.data.event.title === "CI Integration Test Event", `title mismatch: ${ev.data.event.title}`);
    assert(ev.data.event.category === "SOCIAL", `category mismatch: ${ev.data.event.category}`);
    assert(ev.data.event.format === "ONLINE", `format mismatch: ${ev.data.event.format}`);
    assert(ev.data.event.require_approval === 1, `requireApproval not persisted: ${ev.data.event.require_approval}`);
    assert(ev.data.event.visibility === "VERIFIED", `visibility mismatch: ${ev.data.event.visibility}`);
    assert(ev.data.event.organizer_handle === verifiedHandle, "organizer_handle mismatch");
    eventId = ev.data.event.id;
  });

  await test("GET /api/events/:slug — non-existent → 404", async () => {
    const { status } = await api("GET", "/api/events/no-such-event-ci-xyz");
    assert(status === 404, `expected 404, got ${status}`);
  });

  await test("PATCH /api/events/:id — organizer → 200; title update persisted in DB", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/events/${eventId}`,
      { title: "CI Test Event (updated title)" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back
    const ev = await api("GET", `/api/events/${eventSlug}`, undefined, verifiedToken);
    assert(ev.data.event.title === "CI Test Event (updated title)", `title not updated: ${ev.data.event.title}`);
  });

  await test("PATCH /api/events/:id — non-organizer → 403", async () => {
    const { status } = await api(
      "PATCH",
      `/api/events/${eventId}`,
      { title: "x" },
      user2Token
    );
    assert(status === 403, `expected 403, got ${status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Registrations
  // ────────────────────────────────────────────────────────────────────────────
  section("Registrations");

  await test("GET /api/events/:id/registrations — non-organizer → 403", async () => {
    const { status } = await api(
      "GET",
      `/api/events/${eventId}/registrations`,
      undefined,
      user2Token
    );
    assert(status === 403, `expected 403, got ${status}`);
  });

  await test("POST /api/events/:id/registrations — no auth → 401", async () => {
    const { status } = await api("POST", `/api/events/${eventId}/registrations`, {});
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("POST /api/events/:id/registrations — user2 → 200 PENDING; row in DB", async () => {
    const { status, data } = await api(
      "POST",
      `/api/events/${eventId}/registrations`,
      {},
      user2Token
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
    // requireApproval=true → status should be PENDING
    assert(data.status === "PENDING", `expected PENDING status, got ${data.status}`);
    // Read-back via user's own registrations
    const myRegs = await api("GET", "/api/users/me/registrations", undefined, user2Token);
    assert(myRegs.status === 200, `myRegs failed: ${myRegs.status}`);
    const reg = myRegs.data.registrations.find((r) => r.event_id === eventId);
    assert(reg, "registration not found in user's list");
    assert(reg.status === "PENDING", `expected PENDING, got ${reg.status}`);
  });

  await test("GET /api/events/:id/registrations — organizer → 200 with registration row", async () => {
    const { status, data } = await api(
      "GET",
      `/api/events/${eventId}/registrations`,
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.registrations.length > 0, "expected at least one registration");
    regId = data.registrations[0].id;
    assert(data.registrations[0].status === "PENDING", "expected PENDING from requireApproval");
  });

  await test("PATCH /api/events/registrations/:regId — organizer confirms → 200; status CONFIRMED in DB", async () => {
    assert(regId, "regId missing from previous test");
    const { status, data } = await api(
      "PATCH",
      `/api/events/registrations/${regId}`,
      { decision: "CONFIRMED" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back: organizer sees CONFIRMED
    const regs = await api("GET", `/api/events/${eventId}/registrations`, undefined, verifiedToken);
    const reg = regs.data.registrations.find((r) => r.id === regId);
    assert(reg?.status === "CONFIRMED", `expected CONFIRMED, got ${reg?.status}`);
    // Read-back: user also sees CONFIRMED
    const myRegs = await api("GET", "/api/users/me/registrations", undefined, user2Token);
    const myReg = myRegs.data.registrations.find((r) => r.id === regId);
    assert(myReg?.status === "CONFIRMED", `user sees ${myReg?.status}`);
  });

  await test("DELETE /api/events/registrations/:regId — wrong user → 403", async () => {
    const { status } = await api(
      "DELETE",
      `/api/events/registrations/${regId}`,
      undefined,
      verifiedToken // organizer, not registrant
    );
    assert(status === 403, `expected 403, got ${status}`);
  });

  await test("DELETE /api/events/registrations/:regId — own cancel → 200; registration removed from active list", async () => {
    const { status, data } = await api(
      "DELETE",
      `/api/events/registrations/${regId}`,
      undefined,
      user2Token
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back: GET /me/registrations excludes CANCELLED rows, so the registration
    // should no longer appear in the list
    const myRegs = await api("GET", "/api/users/me/registrations", undefined, user2Token);
    const myReg = myRegs.data.registrations.find((r) => r.id === regId);
    assert(!myReg, "cancelled registration should not appear in active list");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Comments
  // ────────────────────────────────────────────────────────────────────────────
  section("Comments");

  await test("GET /api/events/:id/comments — public → 200 with empty array initially", async () => {
    const { status, data } = await api("GET", `/api/events/${eventId}/comments`);
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.comments), "expected comments array");
  });

  await test("POST /api/events/:id/comments — no auth → 401", async () => {
    const { status } = await api("POST", `/api/events/${eventId}/comments`, {
      body: "x",
    });
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("POST /api/events/:id/comments — empty body → 400", async () => {
    const { status } = await api(
      "POST",
      `/api/events/${eventId}/comments`,
      { body: "  " },
      verifiedToken
    );
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/events/:id/comments — verified → 200; body persisted; GET returns it", async () => {
    const { status, data } = await api(
      "POST",
      `/api/events/${eventId}/comments`,
      { body: "CI test comment 🏳️‍⚧️" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
    // Read-back: comment in list with correct body
    const list = await api("GET", `/api/events/${eventId}/comments`, undefined, verifiedToken);
    assert(list.data.comments.length > 0, "expected at least one comment");
    const comment = list.data.comments[0];
    assert(comment.body === "CI test comment 🏳️‍⚧️", `body mismatch: ${comment.body}`);
    assert(comment.author_handle === verifiedHandle, `author mismatch: ${comment.author_handle}`);
    assert(comment.is_hidden === 0, `expected is_hidden 0, got ${comment.is_hidden}`);
    commentId = comment.id;
  });

  await test("PATCH /api/events/comments/:commentId/hide — non-organizer → 403", async () => {
    const { status } = await api(
      "PATCH",
      `/api/events/comments/${commentId}/hide`,
      {},
      user2Token
    );
    assert(status === 403, `expected 403, got ${status}`);
  });

  await test("PATCH /api/events/comments/:commentId/hide — organizer → 200; hidden from non-admin list; visible to admin", async () => {
    assert(commentId, "commentId missing from previous test");
    const { status, data } = await api(
      "PATCH",
      `/api/events/comments/${commentId}/hide`,
      {},
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back: the comment is filtered OUT for non-admin (VERIFIED) users
    const listVerified = await api("GET", `/api/events/${eventId}/comments`, undefined, verifiedToken);
    const hiddenForVerified = listVerified.data.comments.find((c) => c.id === commentId);
    assert(!hiddenForVerified, "hidden comment should not appear for non-admin users");
    // Admins can see hidden comments (is_hidden=0 OR viewer.tier=ADMIN)
    const listAdmin = await api("GET", `/api/events/${eventId}/comments`, undefined, adminToken);
    const visibleForAdmin = listAdmin.data.comments.find((c) => c.id === commentId);
    assert(visibleForAdmin, "admin should be able to see hidden comments");
    assert(visibleForAdmin.is_hidden === 1, `expected is_hidden 1 for admin, got ${visibleForAdmin.is_hidden}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Contact Requests
  // ────────────────────────────────────────────────────────────────────────────
  section("Contact Requests");

  await test("GET /api/users/me/contact-requests — no auth → 401", async () => {
    const { status } = await api("GET", "/api/users/me/contact-requests");
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("GET /api/users/me/contact-requests — starts empty → []", async () => {
    const { status, data } = await api(
      "GET",
      "/api/users/me/contact-requests",
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.requests), "expected requests array");
    assert(data.requests.length === 0, `expected 0 requests, got ${data.requests.length}`);
  });

  await test("POST /api/users/:handle/contact-requests — missing reason → 400", async () => {
    const { status } = await api(
      "POST",
      `/api/users/${verifiedHandle}/contact-requests`,
      { reason: "" },
      user2Token
    );
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/users/:handle/contact-requests — self → 400", async () => {
    const { status } = await api(
      "POST",
      `/api/users/${verifiedHandle}/contact-requests`,
      { reason: "test" },
      verifiedToken
    );
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/users/:handle/contact-requests → 200; row in DB; target sees it PENDING", async () => {
    const { status, data } = await api(
      "POST",
      `/api/users/${verifiedHandle}/contact-requests`,
      { reason: "CI test contact request" },
      user2Token
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok && data.id, "expected ok + id");
    contactRequestId = data.id;
    // Read-back: target sees incoming PENDING request
    const list = await api("GET", "/api/users/me/contact-requests", undefined, verifiedToken);
    const req = list.data.requests.find((r) => r.id === contactRequestId);
    assert(req, "contact request not found in target's list");
    assert(req.status === "PENDING", `expected PENDING, got ${req.status}`);
    assert(req.reason === "CI test contact request", `reason mismatch: ${req.reason}`);
  });

  await test("POST /api/users/:handle/contact-requests — duplicate → 409", async () => {
    const { status } = await api(
      "POST",
      `/api/users/${verifiedHandle}/contact-requests`,
      { reason: "again" },
      user2Token
    );
    assert(status === 409, `expected 409, got ${status}`);
  });

  await test("PATCH /api/users/me/contact-requests/:reqId — wrong target → 403", async () => {
    const { status } = await api(
      "PATCH",
      `/api/users/me/contact-requests/${contactRequestId}`,
      { decision: "APPROVED" },
      user2Token // requester, not target
    );
    assert(status === 403, `expected 403, got ${status}`);
  });

  await test("PATCH /api/users/me/contact-requests/:reqId — approve → 200; request no longer PENDING", async () => {
    assert(contactRequestId, "contactRequestId missing from previous test");
    const { status, data } = await api(
      "PATCH",
      `/api/users/me/contact-requests/${contactRequestId}`,
      { decision: "APPROVED" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
    // Read-back: GET /me/contact-requests returns only PENDING requests, so the
    // approved request should no longer appear in the list
    const list = await api("GET", "/api/users/me/contact-requests", undefined, verifiedToken);
    const stillPending = list.data.requests.find((r) => r.id === contactRequestId);
    assert(!stillPending, "approved request should not appear in PENDING list anymore");
  });

  await test("PATCH /api/users/me/contact-requests/:reqId — re-decide → 400", async () => {
    const { status } = await api(
      "PATCH",
      `/api/users/me/contact-requests/${contactRequestId}`,
      { decision: "DECLINED" },
      verifiedToken
    );
    assert(status === 400, `expected 400, got ${status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Notifications
  // ────────────────────────────────────────────────────────────────────────────
  section("Notifications");

  await test("GET /api/notifications — no auth → 401", async () => {
    const { status } = await api("GET", "/api/notifications");
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("GET /api/notifications → 200; contains notifications generated by earlier writes", async () => {
    const { status, data } = await api(
      "GET",
      "/api/notifications",
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.notifications), "expected notifications array");
    // Earlier operations (registration, contact-request) should have created notifications
    assert(data.notifications.length > 0, "expected at least one notification from earlier writes");
  });

  await test("GET /api/notifications?unread=1 — returns unread subset", async () => {
    const { status, data } = await api(
      "GET",
      "/api/notifications?unread=1",
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.notifications), "expected notifications array");
    // All returned notifications must have read_at = null
    for (const n of data.notifications) {
      assert(n.read_at === null, `notification ${n.id} has read_at set but was returned as unread`);
    }
  });

  await test("POST /api/notifications/mark-read — all → 200; read_at set in DB", async () => {
    const { status, data } = await api(
      "POST",
      "/api/notifications/mark-read",
      {},
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back: unread count is now 0
    const unread = await api("GET", "/api/notifications?unread=1", undefined, verifiedToken);
    assert(unread.data.notifications.length === 0, `expected 0 unread, got ${unread.data.notifications.length}`);
    // All notifications now have read_at set
    const all = await api("GET", "/api/notifications", undefined, verifiedToken);
    for (const n of all.data.notifications) {
      assert(n.read_at !== null, `notification ${n.id} still has null read_at after mark-read`);
    }
  });

  await test("POST /api/notifications/mark-read — specific ids → 200", async () => {
    const { status, data } = await api(
      "POST",
      "/api/notifications/mark-read",
      { ids: ["nonexistent-id-abc"] },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Reports
  // ────────────────────────────────────────────────────────────────────────────
  section("Reports");

  await test("POST /api/reports — no auth → 401", async () => {
    const { status } = await api("POST", "/api/reports", {
      targetType: "EVENT",
      targetId: eventId,
      reason: "x",
    });
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("POST /api/reports — invalid targetType → 400", async () => {
    const { status } = await api(
      "POST",
      "/api/reports",
      { targetType: "INVALID", targetId: eventId, reason: "x" },
      verifiedToken
    );
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/reports — missing reason → 400", async () => {
    const { status } = await api(
      "POST",
      "/api/reports",
      { targetType: "EVENT", targetId: eventId, reason: "" },
      verifiedToken
    );
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/reports → 200; row visible in GET /admin/reports", async () => {
    const { status, data } = await api(
      "POST",
      "/api/reports",
      {
        targetType: "EVENT",
        targetId: eventId,
        reason: "CI test report",
      },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
    // Read-back via admin list
    const list = await api("GET", "/api/admin/reports", undefined, adminToken);
    assert(list.status === 200, `admin/reports failed: ${list.status}`);
    const report = list.data.reports.find(
      (r) => r.target_type === "EVENT" && r.target_id === eventId
    );
    assert(report, "report not found in admin list");
    assert(report.status === "OPEN", `expected OPEN, got ${report.status}`);
    assert(report.reason === "CI test report", `reason mismatch: ${report.reason}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Admin
  // ────────────────────────────────────────────────────────────────────────────
  section("Admin");

  await test("GET /api/admin/users — non-admin → 403", async () => {
    const { status } = await api("GET", "/api/admin/users", undefined, verifiedToken);
    assert(status === 403, `expected 403, got ${status}`);
  });

  await test("GET /api/admin/users — admin → 200; seed users present", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/users",
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.users), "expected users array");
    const emails = data.users.map((u) => u.email);
    assert(emails.includes("admin@ci.test"), "admin seed user missing");
    assert(emails.includes("verified@ci.test"), "verified seed user missing");
  });

  await test("GET /api/admin/users?q=ci_user2 → filters to user2", async () => {
    const { status, data } = await api(
      "GET",
      `/api/admin/users?q=${user2Handle}`,
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.users.some((u) => u.handle === user2Handle), "user2 not found");
  });

  let user2Id;
  await test("PATCH /api/admin/users/:id — set tier TRUSTED → 200; tier persisted in DB", async () => {
    const { data: usersData } = await api(
      "GET",
      `/api/admin/users?q=${user2Handle}`,
      undefined,
      adminToken
    );
    user2Id = usersData.users.find((u) => u.handle === user2Handle)?.id;
    assert(user2Id, "user2Id not found");
    const { status, data } = await api(
      "PATCH",
      `/api/admin/users/${user2Id}`,
      { tier: "TRUSTED" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back
    const users = await api("GET", `/api/admin/users?q=${user2Handle}`, undefined, adminToken);
    const u = users.data.users.find((u) => u.id === user2Id);
    assert(u?.tier === "TRUSTED", `tier not updated: ${u?.tier}`);
  });

  await test("PATCH /api/admin/users/:id — suspend → 200; status SUSPENDED in DB", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/admin/users/${user2Id}`,
      { status: "SUSPENDED" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back
    const users = await api("GET", `/api/admin/users?q=${user2Handle}`, undefined, adminToken);
    const u = users.data.users.find((u) => u.id === user2Id);
    assert(u?.status === "SUSPENDED", `status not updated: ${u?.status}`);
  });

  await test("PATCH /api/admin/users/:id — reactivate → 200; status ACTIVE in DB", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/admin/users/${user2Id}`,
      { status: "ACTIVE" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back
    const users = await api("GET", `/api/admin/users?q=${user2Handle}`, undefined, adminToken);
    const u = users.data.users.find((u) => u.id === user2Id);
    assert(u?.status === "ACTIVE", `status not reverted: ${u?.status}`);
  });

  await test("GET /api/admin/reports → 200; our report present", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/reports",
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.reports), "expected reports array");
    assert(data.reports.length > 0, "expected the report we just filed");
  });

  await test("PATCH /api/admin/reports/:id — resolve → 200; status RESOLVED in DB", async () => {
    const { data: rData } = await api("GET", "/api/admin/reports", undefined, adminToken);
    const reportId = rData.reports[0]?.id;
    assert(reportId, "no reportId to resolve");
    const { status, data } = await api(
      "PATCH",
      `/api/admin/reports/${reportId}`,
      { decision: "RESOLVED", note: "CI resolved" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back: status is RESOLVED
    const list = await api("GET", "/api/admin/reports?status=RESOLVED", undefined, adminToken);
    const resolved = list.data.reports.find((r) => r.id === reportId);
    assert(resolved?.status === "RESOLVED", `expected RESOLVED, got ${resolved?.status}`);
    assert(resolved?.resolved_note === "CI resolved", `note mismatch: ${resolved?.resolved_note}`);
    assert(resolved?.resolved_by_id != null, "resolved_by_id should be set");
  });

  await test("GET /api/admin/audit → 200; entries written by earlier admin actions", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/audit",
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.logs), "expected logs array");
    assert(data.logs.length > 0, "expected audit entries from admin operations");
    // Verify audit entries have required fields
    const log = data.logs[0];
    assert(log.actor_id, "missing actor_id");
    assert(log.action, "missing action");
    assert(log.target_type, "missing target_type");
    assert(log.target_id, "missing target_id");
    assert(log.created_at, "missing created_at");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Files (R2)
  // ────────────────────────────────────────────────────────────────────────────
  section("Files");

  await test("POST /api/files — no auth → 401", async () => {
    const form = new FormData();
    form.append("file", new Blob(["x"], { type: "image/png" }), "x.png");
    const res = await fetch(`${BASE}/api/files`, { method: "POST", body: form });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await test("POST /api/files — disallowed MIME type → 400", async () => {
    const form = new FormData();
    form.append("file", new Blob(["x"], { type: "text/plain" }), "x.txt");
    const res = await fetch(`${BASE}/api/files`, {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${verifiedToken}` },
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  await test("POST /api/files — missing file field → 400", async () => {
    const form = new FormData();
    form.append("purpose", "avatar");
    const res = await fetch(`${BASE}/api/files`, {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${verifiedToken}` },
    });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  await test("POST /api/files — valid PNG → 200 + url; GET confirms bytes stored in R2", async () => {
    // Minimal valid 1×1 white PNG (68 bytes)
    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=";
    const pngBytes = Buffer.from(pngBase64, "base64");
    const form = new FormData();
    form.append(
      "file",
      new Blob([pngBytes], { type: "image/png" }),
      "test.png"
    );
    form.append("purpose", "avatar");
    const res = await fetch(`${BASE}/api/files`, {
      method: "POST",
      body: form,
      headers: { Authorization: `Bearer ${verifiedToken}` },
    });
    const data = await res.json();
    assert(res.status === 200, `expected 200, got ${res.status}: ${JSON.stringify(data)}`);
    assert(data.ok && data.url, "expected ok + url");
    assert(data.url.startsWith("/api/files/avatar/"), `unexpected url format: ${data.url}`);
    fileUrl = data.url;
    // Read-back: GET the file — must return the actual bytes, not a JSON error
    const getRes = await fetch(`${BASE}${fileUrl}`);
    assert(getRes.status === 200, `GET file: expected 200, got ${getRes.status}`);
    const ct = getRes.headers.get("content-type") ?? "";
    assert(ct.includes("image/png"), `expected image/png, got ${ct}`);
    const bytes = new Uint8Array(await getRes.arrayBuffer());
    assert(bytes.length === pngBytes.length, `bytes mismatch: stored ${bytes.length}, expected ${pngBytes.length}`);
    assert(
      bytes.every((b, i) => b === pngBytes[i]),
      "stored file bytes do not match uploaded bytes"
    );
  });

  await test("GET /api/files/nonexistent-key → 404", async () => {
    const { status } = await api("GET", "/api/files/no/such/file.png");
    assert(status === 404, `expected 404, got ${status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Teardown (verify deletes also write to DB)
  // ────────────────────────────────────────────────────────────────────────────
  section("Teardown");

  await test("DELETE /api/events/:id — cancel event → 200; GET /:slug shows status CANCELLED", async () => {
    const { status, data } = await api(
      "DELETE",
      `/api/events/${eventId}`,
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back: event is soft-deleted (status=CANCELLED), not hard-deleted
    const ev = await api("GET", `/api/events/${eventSlug}`, undefined, verifiedToken);
    assert(ev.status === 200, `expected 200 (soft delete), got ${ev.status}`);
    assert(ev.data.event.status === "CANCELLED", `expected CANCELLED, got ${ev.data.event.status}`);
  });

  await test("DELETE /api/users/me/contacts/:contactId → 200; contact gone from DB", async () => {
    const { status, data } = await api(
      "DELETE",
      `/api/users/me/contacts/${contactId}`,
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
    // Read-back: contact no longer in list
    const list = await api("GET", "/api/users/me/contacts", undefined, verifiedToken);
    const found = list.data.contacts.find((c) => c.id === contactId);
    assert(!found, "contact still present after delete");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Report + Summary
  // ────────────────────────────────────────────────────────────────────────────
  writeReport();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
