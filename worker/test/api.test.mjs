#!/usr/bin/env node
/**
 * Worker API integration tests.
 *
 * Expects the worker to be running at API_BASE (default: http://localhost:8787)
 * and the local D1 to have been seeded with worker/test/seed.sql.
 *
 * Exit code: 0 = all pass, 1 = one or more failures.
 */

const BASE = (process.env.API_BASE ?? "http://localhost:8787").replace(/\/$/, "");

// ── Tiny test harness ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

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
    passed++;
  } catch (err) {
    process.stderr.write(`  ✗ ${name}: ${err.message}\n`);
    failures.push({ name, error: err.message });
    failed++;
  }
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

// ── Shared state ─────────────────────────────────────────────────────────────

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
  console.log("Health:");

  await test("GET /api/health → 200 { ok: true }", async () => {
    const { status, data } = await api("GET", "/api/health");
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok === true, "expected ok");
    assert(typeof data.ts === "string", "expected ts timestamp");
  });

  await test("GET /unknown-path → 404", async () => {
    const { status, data } = await api("GET", "/api/does-not-exist");
    assert(status === 404, `expected 404, got ${status}`);
    assert(data.error, "expected error field");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Auth
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nAuth:");

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

  await test("POST /api/auth/send-link — valid email → 200", async () => {
    const { status, data } = await api("POST", "/api/auth/send-link", {
      email: "admin@ci.test",
    });
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  await test("POST /api/auth/verify — invalid token → 400", async () => {
    const { status } = await api("POST", "/api/auth/verify", {
      token: "bad-token-xyz",
    });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/auth/verify — admin token → 200 + JWT", async () => {
    const { status, data } = await api("POST", "/api/auth/verify", {
      token: "ci-token-admin",
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.token, "expected token");
    assert(data.user.tier === "ADMIN", `expected ADMIN, got ${data.user.tier}`);
    adminToken = data.token;
  });

  await test("POST /api/auth/verify — verified token → 200 + JWT", async () => {
    const { status, data } = await api("POST", "/api/auth/verify", {
      token: "ci-token-verified",
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.token, "expected token");
    assert(data.user.tier === "VERIFIED", `expected VERIFIED, got ${data.user.tier}`);
    verifiedToken = data.token;
    verifiedHandle = data.user.handle;
  });

  await test("POST /api/auth/verify — user2 token → 200 + JWT", async () => {
    const { status, data } = await api("POST", "/api/auth/verify", {
      token: "ci-token-user2",
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    user2Token = data.token;
    user2Handle = data.user.handle;
  });

  await test("POST /api/auth/verify — reuse used token → 400", async () => {
    // admin token was already consumed above
    const { status } = await api("POST", "/api/auth/verify", {
      token: "ci-token-admin",
    });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("GET /api/auth/me — no token → 401", async () => {
    const { status } = await api("GET", "/api/auth/me");
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("GET /api/auth/me — valid token → 200", async () => {
    const { status, data } = await api("GET", "/api/auth/me", undefined, adminToken);
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.email === "admin@ci.test", "wrong email");
    assert(data.tier === "ADMIN", "wrong tier");
  });

  await test("POST /api/auth/verify-invite — unknown code → 400", async () => {
    const { status } = await api("POST", "/api/auth/verify-invite", {
      email: "x@y.com",
      code: "BADCODEXX",
    });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/auth/verify-invite — seed code → 200", async () => {
    const { status, data } = await api("POST", "/api/auth/verify-invite", {
      email: "new@ci.test",
      code: "CI-SEED-CODE",
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
  });

  await test("POST /api/auth/sign-out → 200", async () => {
    const { status, data } = await api("POST", "/api/auth/sign-out", {}, adminToken);
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Users
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nUsers:");

  await test("GET /api/users/:handle — authenticated → 200", async () => {
    const { status, data } = await api(
      "GET",
      `/api/users/${verifiedHandle}`,
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.handle === verifiedHandle, "handle mismatch");
  });

  await test("GET /api/users/:handle — unknown → 404", async () => {
    const { status } = await api("GET", "/api/users/nobody_ci_xyz", undefined, adminToken);
    assert(status === 404, `expected 404, got ${status}`);
  });

  await test("PATCH /api/users/me — no auth → 401", async () => {
    const { status } = await api("PATCH", "/api/users/me", { displayName: "x" });
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("PATCH /api/users/me — update profile → 200", async () => {
    const { status, data } = await api(
      "PATCH",
      "/api/users/me",
      { displayName: "CI Admin Updated", bio: "bio from CI" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Contacts
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nContacts:");

  await test("GET /api/users/me/contacts — no auth → 401", async () => {
    const { status } = await api("GET", "/api/users/me/contacts");
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("GET /api/users/me/contacts → 200 []", async () => {
    const { status, data } = await api(
      "GET",
      "/api/users/me/contacts",
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.contacts), "expected contacts array");
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

  await test("POST /api/users/me/contacts → 200", async () => {
    const { status, data } = await api(
      "POST",
      "/api/users/me/contacts",
      { kind: "TELEGRAM", value: "@ci_verified", visibility: "VERIFIED" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok && data.id, "expected ok + id");
    contactId = data.id;
  });

  await test("PATCH /api/users/me/contacts/:id → 200", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/users/me/contacts/${contactId}`,
      { label: "My Telegram" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
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
  console.log("\nInvites:");

  await test("GET /api/users/me/invites → 200", async () => {
    const { status, data } = await api(
      "GET",
      "/api/users/me/invites",
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.invites), "expected invites array");
  });

  await test("POST /api/users/me/invites — admin → 200", async () => {
    const { status, data } = await api(
      "POST",
      "/api/users/me/invites",
      { note: "CI invite" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.code, "expected code");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Blocks
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nBlocks:");

  await test("GET /api/users/me/blocks — no auth → 401", async () => {
    const { status } = await api("GET", "/api/users/me/blocks");
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("GET /api/users/me/blocks → 200 []", async () => {
    const { status, data } = await api(
      "GET",
      "/api/users/me/blocks",
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.blocks), "expected blocks array");
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

  await test("POST /api/users/:handle/block → 200", async () => {
    const { status, data } = await api(
      "POST",
      `/api/users/${user2Handle}/block`,
      {},
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  await test("DELETE /api/users/:handle/block → 200", async () => {
    const { status, data } = await api(
      "DELETE",
      `/api/users/${user2Handle}/block`,
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Applications
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nApplications:");

  await test("POST /api/applications — missing email → 400", async () => {
    const { status } = await api("POST", "/api/applications", { email: "" });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await test("POST /api/applications → 200", async () => {
    const { status, data } = await api("POST", "/api/applications", {
      email: "applicant@ci.test",
      answers: { identity: "test", motivation: "ci testing" },
    });
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
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

  await test("GET /api/applications/mine → 200", async () => {
    const { status, data } = await api(
      "GET",
      "/api/applications/mine?email=applicant@ci.test"
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.application !== undefined, "expected application field");
    applicationId = data.application?.id;
  });

  await test("GET /api/applications — non-admin → 403", async () => {
    const { status } = await api("GET", "/api/applications", undefined, verifiedToken);
    assert(status === 403, `expected 403, got ${status}`);
  });

  await test("GET /api/applications — admin → 200", async () => {
    const { status, data } = await api(
      "GET",
      "/api/applications",
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.applications), "expected applications array");
  });

  await test("PATCH /api/applications/:id — approve → 200", async () => {
    assert(applicationId, "applicationId missing from previous test");
    const { status, data } = await api(
      "PATCH",
      `/api/applications/${applicationId}`,
      { decision: "APPROVED" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
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
  console.log("\nEvents:");

  await test("GET /api/events → 200 []", async () => {
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

  await test("POST /api/events — verified user → 200", async () => {
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
  });

  await test("GET /api/events/:slug → 200", async () => {
    const { status, data } = await api(
      "GET",
      `/api/events/${eventSlug}`,
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.event.slug === eventSlug, "slug mismatch");
    eventId = data.event.id;
  });

  await test("GET /api/events/:slug — non-existent → 404", async () => {
    const { status } = await api("GET", "/api/events/no-such-event-ci-xyz");
    assert(status === 404, `expected 404, got ${status}`);
  });

  await test("PATCH /api/events/:id — organizer → 200", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/events/${eventId}`,
      { title: "CI Test Event (updated)" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
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
  console.log("\nRegistrations:");

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

  await test("POST /api/events/:id/registrations — user2 → 200", async () => {
    const { status, data } = await api(
      "POST",
      `/api/events/${eventId}/registrations`,
      {},
      user2Token
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
    // requireApproval=true → PENDING
    assert(data.status === "PENDING", `expected PENDING, got ${data.status}`);
  });

  await test("GET /api/events/:id/registrations — organizer → 200", async () => {
    const { status, data } = await api(
      "GET",
      `/api/events/${eventId}/registrations`,
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.registrations.length > 0, "expected at least one registration");
    regId = data.registrations[0].id;
  });

  await test("PATCH /api/events/registrations/:regId — organizer confirms → 200", async () => {
    assert(regId, "regId missing from previous test");
    const { status, data } = await api(
      "PATCH",
      `/api/events/registrations/${regId}`,
      { decision: "CONFIRMED" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  await test("GET /api/users/me/registrations — user2 → 200", async () => {
    const { status, data } = await api(
      "GET",
      "/api/users/me/registrations",
      undefined,
      user2Token
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.registrations), "expected registrations array");
  });

  await test("DELETE /api/events/registrations/:regId — wrong user → 403", async () => {
    const { status } = await api(
      "DELETE",
      `/api/events/registrations/${regId}`,
      undefined,
      verifiedToken // organizer, not the registrant
    );
    assert(status === 403, `expected 403, got ${status}`);
  });

  await test("DELETE /api/events/registrations/:regId — own cancel → 200", async () => {
    const { status, data } = await api(
      "DELETE",
      `/api/events/registrations/${regId}`,
      undefined,
      user2Token
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Comments
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nComments:");

  await test("GET /api/events/:id/comments — public → 200", async () => {
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

  await test("POST /api/events/:id/comments — verified → 200", async () => {
    const { status, data } = await api(
      "POST",
      `/api/events/${eventId}/comments`,
      { body: "CI test comment 🏳️‍⚧️" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
  });

  await test("GET /api/events/:id/comments — returns new comment", async () => {
    const { data } = await api(
      "GET",
      `/api/events/${eventId}/comments`,
      undefined,
      verifiedToken
    );
    assert(data.comments.length > 0, "expected at least one comment");
    commentId = data.comments[0].id;
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

  await test("PATCH /api/events/comments/:commentId/hide — organizer → 200", async () => {
    assert(commentId, "commentId missing from previous test");
    const { status, data } = await api(
      "PATCH",
      `/api/events/comments/${commentId}/hide`,
      {},
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Contact Requests
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nContact Requests:");

  await test("GET /api/users/me/contact-requests — no auth → 401", async () => {
    const { status } = await api("GET", "/api/users/me/contact-requests");
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("GET /api/users/me/contact-requests → 200 []", async () => {
    const { status, data } = await api(
      "GET",
      "/api/users/me/contact-requests",
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.requests), "expected requests array");
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

  await test("POST /api/users/:handle/contact-requests → 200", async () => {
    const { status, data } = await api(
      "POST",
      `/api/users/${verifiedHandle}/contact-requests`,
      { reason: "CI test contact request" },
      user2Token
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok && data.id, "expected ok + id");
    contactRequestId = data.id;
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

  await test("PATCH /api/users/me/contact-requests/:reqId — approve → 200", async () => {
    assert(contactRequestId, "contactRequestId missing from previous test");
    const { status, data } = await api(
      "PATCH",
      `/api/users/me/contact-requests/${contactRequestId}`,
      { decision: "APPROVED" },
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(data)}`);
    assert(data.ok, "expected ok");
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
  console.log("\nNotifications:");

  await test("GET /api/notifications — no auth → 401", async () => {
    const { status } = await api("GET", "/api/notifications");
    assert(status === 401, `expected 401, got ${status}`);
  });

  await test("GET /api/notifications → 200", async () => {
    const { status, data } = await api(
      "GET",
      "/api/notifications",
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.notifications), "expected notifications array");
    // Notifications should have been created by the registration + contact-request flows
    assert(data.notifications.length > 0, "expected at least one notification");
  });

  await test("GET /api/notifications?unread=1 → 200", async () => {
    const { status, data } = await api(
      "GET",
      "/api/notifications?unread=1",
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.notifications), "expected notifications array");
  });

  await test("POST /api/notifications/mark-read — all → 200", async () => {
    const { status, data } = await api(
      "POST",
      "/api/notifications/mark-read",
      {},
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  await test("POST /api/notifications/mark-read — specific ids → 200", async () => {
    const { status, data } = await api(
      "POST",
      "/api/notifications/mark-read",
      { ids: ["nonexistent-id-abc"] },
      verifiedToken
    );
    // No matching rows is still OK
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Reports
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nReports:");

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

  await test("POST /api/reports → 200", async () => {
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
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Admin
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nAdmin:");

  await test("GET /api/admin/users — non-admin → 403", async () => {
    const { status } = await api("GET", "/api/admin/users", undefined, verifiedToken);
    assert(status === 403, `expected 403, got ${status}`);
  });

  await test("GET /api/admin/users — admin → 200", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/users",
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.users), "expected users array");
    assert(data.users.length > 0, "expected at least one user");
  });

  await test("GET /api/admin/users?q=ci_user2 → contains user2", async () => {
    const { status, data } = await api(
      "GET",
      `/api/admin/users?q=${user2Handle}`,
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(
      data.users.some((u) => u.handle === user2Handle),
      "user2 not found"
    );
  });

  let user2Id;
  await test("PATCH /api/admin/users/:id — set tier → 200", async () => {
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
  });

  await test("PATCH /api/admin/users/:id — suspend → 200", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/admin/users/${user2Id}`,
      { status: "SUSPENDED" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  await test("PATCH /api/admin/users/:id — reactivate → 200", async () => {
    const { status, data } = await api(
      "PATCH",
      `/api/admin/users/${user2Id}`,
      { status: "ACTIVE" },
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  await test("GET /api/admin/reports → 200", async () => {
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

  await test("PATCH /api/admin/reports/:id — resolve → 200", async () => {
    const { data: rData } = await api(
      "GET",
      "/api/admin/reports",
      undefined,
      adminToken
    );
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
  });

  await test("GET /api/admin/audit → 200", async () => {
    const { status, data } = await api(
      "GET",
      "/api/admin/audit",
      undefined,
      adminToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(data.logs), "expected logs array");
    assert(data.logs.length > 0, "expected audit entries");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Files (R2)
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nFiles:");

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

  await test("POST /api/files — valid PNG → 200 + url", async () => {
    // Minimal valid 1×1 white PNG (67 bytes)
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
    fileUrl = data.url;
  });

  await test("GET /api/files/* — serves uploaded file → 200 image/png", async () => {
    assert(fileUrl, "fileUrl missing from previous test");
    const res = await fetch(`${BASE}${fileUrl}`);
    assert(res.status === 200, `expected 200, got ${res.status}`);
    assert(
      (res.headers.get("content-type") ?? "").includes("image/png"),
      "expected image/png content-type"
    );
  });

  await test("GET /api/files/nonexistent-key → 404", async () => {
    const { status } = await api("GET", "/api/files/no/such/file.png");
    assert(status === 404, `expected 404, got ${status}`);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Teardown
  // ────────────────────────────────────────────────────────────────────────────
  console.log("\nTeardown:");

  await test("DELETE /api/events/:id — cancel event → 200", async () => {
    const { status, data } = await api(
      "DELETE",
      `/api/events/${eventId}`,
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  await test("DELETE /api/users/me/contacts/:contactId → 200", async () => {
    const { status, data } = await api(
      "DELETE",
      `/api/users/me/contacts/${contactId}`,
      undefined,
      verifiedToken
    );
    assert(status === 200, `expected 200, got ${status}`);
    assert(data.ok, "expected ok");
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${"─".repeat(56)}`);
  if (failed === 0) {
    console.log(`✓ All ${total} tests passed`);
  } else {
    console.log(`Results: ${passed}/${total} passed, ${failed} failed\n`);
    console.log("Failures:");
    for (const f of failures) {
      console.log(`  ✗ ${f.name}`);
      console.log(`    ${f.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
