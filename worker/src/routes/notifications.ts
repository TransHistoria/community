// Notifications API routes.

import { Hono } from "hono";
import type { Env, Variables, NotificationRow } from "@/types";
import { requireAuth } from "@/middleware/auth";

const notifications = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/notifications
notifications.get("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const unreadOnly = c.req.query("unread") === "1";

  const rows = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE user_id = ?
     ${unreadOnly ? "AND read_at IS NULL" : ""}
     ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(userId)
    .all<NotificationRow>();

  return c.json({ notifications: rows.results });
});

// POST /api/notifications/mark-read — mark all (or specific) as read
notifications.post("/mark-read", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body: { ids?: string[] } = await c.req
    .json<{ ids?: string[] }>()
    .catch(() => ({}));

  if (body.ids && body.ids.length > 0) {
    // Mark specific notifications
    const placeholders = body.ids.map(() => "?").join(",");
    await c.env.DB.prepare(
      `UPDATE notifications SET read_at = datetime('now')
       WHERE user_id = ? AND id IN (${placeholders}) AND read_at IS NULL`,
    )
      .bind(userId, ...body.ids)
      .run();
  } else {
    // Mark all unread
    await c.env.DB.prepare(
      "UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL",
    )
      .bind(userId)
      .run();
  }

  return c.json({ ok: true });
});

export default notifications;
