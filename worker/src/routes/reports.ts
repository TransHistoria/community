// Reports route (available to all logged-in users).

import { Hono } from "hono";
import type { Env, Variables } from "@/types";
import { requireAuth } from "@/middleware/auth";
import { newId } from "@/lib/utils";

const reports = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /api/reports
reports.post("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    targetType: string;
    targetId: string;
    reason: string;
  }>();

  if (!body.targetType || !body.targetId || !body.reason?.trim()) {
    return c.json({ error: "参数缺失" }, 400);
  }

  const VALID_TYPES = ["USER", "EVENT", "COMMENT"];
  if (!VALID_TYPES.includes(body.targetType)) {
    return c.json({ error: "无效的举报类型" }, 400);
  }

  await c.env.DB.prepare(
    "INSERT INTO reports (id, reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(newId(), userId, body.targetType, body.targetId, body.reason.trim())
    .run();

  return c.json({ ok: true });
});

export default reports;
