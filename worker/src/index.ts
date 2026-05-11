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

// ---- Health check ----
app.get("/api/health", (c) => c.json({ ok: true, ts: new Date().toISOString() }));

// ---- Route mounts ----
app.route("/api/auth", authRoutes);
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
  return c.json({ error: "服务器内部错误" }, 500);
});

export default app;
