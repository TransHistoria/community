// Reports route — any logged-in user can submit; LLM auto-handles when it can.
//
// Flow:
//   1. Validate input + insert row in OPEN state.
//   2. Asynchronously evaluate via LLM. Decision branches:
//      - hide_target: hide the offending content, mark report RESOLVED,
//                     notify the content author + the reporter.
//      - dismiss:     mark report DISMISSED, notify the reporter.
//      - escalate:    leave OPEN for the admin queue, notify the reporter
//                     that their report has been received.
//   USER-type reports always escalate (we never let the model auto-suspend).

import { Hono } from "hono";
import type { Env, Variables, ReportRow } from "@/types";
import { requireAuth } from "@/middleware/auth";
import { newId } from "@/lib/utils";
import { evaluateReport, type ReportTargetKind } from "@/lib/llm";

const reports = new Hono<{ Bindings: Env; Variables: Variables }>();

const VALID_TYPES: ReportTargetKind[] = ["USER", "POST", "EVENT", "COMMENT"];

async function notify(
  db: D1Database,
  userId: string,
  kind: string,
  payload: object,
): Promise<void> {
  await db
    .prepare("INSERT INTO notifications (id, user_id, kind, payload) VALUES (?, ?, ?, ?)")
    .bind(newId(), userId, kind, JSON.stringify(payload))
    .run();
}

async function audit(
  db: D1Database,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  meta?: object,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, meta) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(newId(), actorId, action, targetType, targetId, meta ? JSON.stringify(meta) : null)
    .run();
}

/** Load the target's text + author so the LLM has something to read. */
async function loadTarget(
  db: D1Database,
  targetType: ReportTargetKind,
  targetId: string,
): Promise<{ title?: string; body: string; authorId: string | null } | null> {
  if (targetType === "POST") {
    const row = await db
      .prepare("SELECT title, body, author_id FROM posts WHERE id = ?")
      .bind(targetId)
      .first<{ title: string; body: string; author_id: string }>();
    return row ? { title: row.title, body: row.body, authorId: row.author_id } : null;
  }
  if (targetType === "EVENT") {
    const row = await db
      .prepare("SELECT title, description, organizer_id FROM events WHERE id = ?")
      .bind(targetId)
      .first<{ title: string; description: string; organizer_id: string }>();
    return row
      ? { title: row.title, body: row.description, authorId: row.organizer_id }
      : null;
  }
  if (targetType === "COMMENT") {
    const row = await db
      .prepare("SELECT body, author_id FROM comments WHERE id = ?")
      .bind(targetId)
      .first<{ body: string; author_id: string }>();
    return row ? { body: row.body, authorId: row.author_id } : null;
  }
  // USER
  const row = await db
    .prepare("SELECT handle, display_name, bio FROM users WHERE id = ?")
    .bind(targetId)
    .first<{ handle: string; display_name: string; bio: string | null }>();
  return row
    ? {
        title: `@${row.handle} (${row.display_name})`,
        body: row.bio ?? "(无个人简介)",
        authorId: targetId,
      }
    : null;
}

/** Apply hide_target to the actual target row. Returns true on success. */
async function hideTarget(
  db: D1Database,
  targetType: ReportTargetKind,
  targetId: string,
): Promise<boolean> {
  if (targetType === "POST") {
    const res = await db
      .prepare(
        "UPDATE posts SET status = 'HIDDEN', updated_at = datetime('now') WHERE id = ?",
      )
      .bind(targetId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }
  if (targetType === "EVENT") {
    const res = await db
      .prepare(
        "UPDATE events SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?",
      )
      .bind(targetId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }
  if (targetType === "COMMENT") {
    const res = await db
      .prepare(
        "UPDATE comments SET is_hidden = 1, hidden_reason = 'AI 审核(举报触发)' WHERE id = ?",
      )
      .bind(targetId)
      .run();
    return (res.meta?.changes ?? 0) > 0;
  }
  // USER hiding requires admin
  return false;
}

/**
 * Run LLM evaluation + apply result. Fire-and-forget so the user gets
 * an immediate 200; their inbox gets the outcome shortly.
 */
async function runReportEvaluation(
  env: Env,
  reportId: string,
  reporterId: string,
  targetType: ReportTargetKind,
  targetId: string,
  reason: string,
): Promise<void> {
  const target = await loadTarget(env.DB, targetType, targetId);
  if (!target) {
    // Target was deleted between report and eval. Mark dismissed silently.
    await env.DB
      .prepare(
        "UPDATE reports SET status = 'DISMISSED', resolved_note = '目标已不存在', resolved_at = datetime('now') WHERE id = ?",
      )
      .bind(reportId)
      .run();
    return;
  }

  const evalResult = await evaluateReport(env, {
    targetType,
    targetTitle: target.title,
    targetBody: target.body,
    reason,
  });

  if (evalResult.action === "hide_target") {
    const hidden = await hideTarget(env.DB, targetType, targetId);
    if (hidden) {
      await env.DB
        .prepare(
          `UPDATE reports SET status = 'RESOLVED', resolved_note = ?, resolved_by_id = 'system-xiao-t', resolved_at = datetime('now') WHERE id = ?`,
        )
        .bind(evalResult.reason, reportId)
        .run();
      await notify(env.DB, reporterId, "REPORT_AUTO_RESOLVED", {
        reportId,
        targetType,
        targetId,
        action: "hide_target",
        reason: evalResult.reason,
      });
      if (target.authorId && target.authorId !== reporterId) {
        await notify(env.DB, target.authorId, "CONTENT_HIDDEN_BY_REPORT", {
          targetType,
          targetId,
          reason: evalResult.reason,
        });
      }
      await audit(env.DB, "system-xiao-t", "REPORT_AUTO_HIDE", "Report", reportId, {
        verdict: evalResult.verdict,
        targetType,
        targetId,
      });
    } else {
      // Hide failed (target deleted / wrong type). Don't pretend it's RESOLVED;
      // escalate to admin so they can take whatever action remains.
      await env.DB
        .prepare(
          "UPDATE reports SET resolved_note = ? WHERE id = ?",
        )
        .bind(`AI 判定违规但自动隐藏失败,需人工处理: ${evalResult.reason}`, reportId)
        .run();
      await notify(env.DB, reporterId, "REPORT_RECEIVED", {
        reportId,
        targetType,
        targetId,
        reason: "AI 已判定违规,但自动隐藏失败,已转人工",
      });
      await audit(env.DB, "system-xiao-t", "REPORT_AUTO_HIDE_FAILED", "Report", reportId, {
        verdict: evalResult.verdict,
        targetType,
        targetId,
      });
    }
    return;
  }

  if (evalResult.action === "dismiss") {
    await env.DB
      .prepare(
        "UPDATE reports SET status = 'DISMISSED', resolved_note = ?, resolved_by_id = 'system-xiao-t', resolved_at = datetime('now') WHERE id = ?",
      )
      .bind(evalResult.reason, reportId)
      .run();
    await notify(env.DB, reporterId, "REPORT_AUTO_DISMISSED", {
      reportId,
      targetType,
      targetId,
      reason: evalResult.reason,
    });
    await audit(env.DB, "system-xiao-t", "REPORT_AUTO_DISMISS", "Report", reportId, {
      verdict: evalResult.verdict,
    });
    return;
  }

  // escalate: leave OPEN for admin
  await env.DB
    .prepare(
      "UPDATE reports SET resolved_note = ? WHERE id = ?",
    )
    .bind(`AI 建议: ${evalResult.reason}`, reportId)
    .run();
  await notify(env.DB, reporterId, "REPORT_RECEIVED", {
    reportId,
    targetType,
    targetId,
    reason: evalResult.reason,
  });
  await audit(env.DB, "system-xiao-t", "REPORT_ESCALATED", "Report", reportId, {
    verdict: evalResult.verdict,
  });
}

// POST /api/reports
reports.post("/", requireAuth, async (c) => {
  const reporterId = c.get("userId");
  const body = await c.req.json<{
    targetType: string;
    targetId: string;
    reason: string;
  }>();

  if (!body.targetType || !body.targetId || !body.reason?.trim()) {
    return c.json({ error: "参数缺失" }, 400);
  }
  if (!(VALID_TYPES as string[]).includes(body.targetType)) {
    return c.json({ error: "无效的举报类型" }, 400);
  }
  const targetType = body.targetType as ReportTargetKind;
  const reason = body.reason.trim().slice(0, 2000);
  const reportId = newId();

  await c.env.DB
    .prepare(
      "INSERT INTO reports (id, reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(reportId, reporterId, targetType, body.targetId, reason)
    .run();

  // Fire-and-forget LLM evaluation. The user gets an immediate response;
  // the outcome arrives via notifications.
  c.executionCtx.waitUntil(
    runReportEvaluation(c.env, reportId, reporterId, targetType, body.targetId, reason).catch(
      (err) => console.error("runReportEvaluation crashed:", err),
    ),
  );

  return c.json({ ok: true, reportId });
});

export default reports;
