// Main Hono application — mounts all routes and configures CORS.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "@/types";

import authRoutes from "@/routes/auth";
import eventsRoutes from "@/routes/events";
import usersRoutes from "@/routes/users";
import applicationsRoutes from "@/routes/applications";
import notificationsRoutes from "@/routes/notifications";
import adminRoutes from "@/routes/admin";
import reportsRoutes from "@/routes/reports";
import filesRoutes from "@/routes/files";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function isDebugEnabled(env: Env): boolean {
  return Boolean((env.DEBUG ?? "").trim());
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// ---- CORS ----
// Intentionally permissive: allow requests from any third-party frontend.
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
    credentials: false,
  }),
);

// ---- Debug response instrumentation ----
app.use("/*", async (c, next) => {
  const debugEnabled = isDebugEnabled(c.env);
  c.set("debugEnabled", debugEnabled);
  c.set("debugLogs", []);
  if (!debugEnabled) {
    await next();
    return;
  }

  const logs: string[] = [];
  c.set("debugLogs", logs);

  const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  const wrap = (level: "log" | "info" | "warn" | "error" | "debug") =>
    (...args: unknown[]) => {
      logs.push(`[${new Date().toISOString()}] ${level.toUpperCase()} ${args.map(safeStringify).join(" ")}`);
      originalConsole[level](...args);
    };

  console.log = wrap("log");
  console.info = wrap("info");
  console.warn = wrap("warn");
  console.error = wrap("error");
  console.debug = wrap("debug");

  try {
    await next();
  } finally {
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.debug = originalConsole.debug;
  }

  const contentType = c.res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return;

  const body = await c.res.clone().json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return;

  const nextBody = body as Record<string, unknown>;
  const url = new URL(c.req.url);
  const status = c.res.status;
  nextBody.debug = {
    enabled: true,
    method: c.req.method,
    path: url.pathname,
    status,
    logs,
  };
  if (status !== 200 && typeof nextBody.reason !== "string") {
    nextBody.reason = typeof nextBody.error === "string" ? nextBody.error : c.res.statusText || "Request rejected";
  }

  const headers = new Headers(c.res.headers);
  headers.set("content-type", "application/json; charset=UTF-8");
  c.res = new Response(JSON.stringify(nextBody), {
    status: c.res.status,
    statusText: c.res.statusText,
    headers,
  });
});

// ---- Health check ----
app.get("/api/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// ---- Route mounts ----
app.route("/api/auth", authRoutes);
app.route("/api/activities", eventsRoutes);
// Backward compatibility for existing clients/tests still using /api/events.
app.route("/api/events", eventsRoutes);
app.route("/api/users", usersRoutes);
app.route("/api/applications", applicationsRoutes);
app.route("/api/notifications", notificationsRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/reports", reportsRoutes);
app.route("/api/files", filesRoutes);

// ---- 404 fallback ----
app.notFound((c) => c.json({ error: "Not found" }, 404));

// ---- Error handler ----
app.onError((err, c) => {
  console.error(err);
  if (isDebugEnabled(c.env)) {
    return c.json(
      {
        error: "服务器内部错误",
        reason: err.message || "Internal server error",
        detail: {
          name: err.name,
          message: err.message,
          stack: err.stack,
        },
      },
      500,
    );
  }
  return c.json({ error: "服务器内部错误" }, 500);
});

export default app;
