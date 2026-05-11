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

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---- CORS ----
// Allow requests from the static frontend (GitHub Pages) and localhost dev.
app.use(
  "/*",
  cors({
    origin: (origin, c) => {
      const allowed = [
        c.env.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
      ].filter(Boolean);
      return allowed.includes(origin) ? origin : allowed[0] ?? origin;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    maxAge: 86400,
    credentials: true,
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

// ---- 404 fallback ----
app.notFound((c) => c.json({ error: "Not found" }, 404));

// ---- Error handler ----
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "服务器内部错误" }, 500);
});

export default app;
