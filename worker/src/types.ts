// Cloudflare Worker environment bindings and shared DB row types.

import type { D1Database, R2Bucket, SendEmail } from "@cloudflare/workers-types";

// ---- Cloudflare Worker environment ----

export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  SEND_EMAIL: SendEmail;

  // Secrets / vars (set via wrangler secret put or dashboard)
  JWT_SECRET: string;
  APP_NAME: string;
  APP_LOCALE: string;
  EMAIL_FROM: string;
  FRONTEND_URL: string;
  TURNSTILE_SECRET_KEY?: string;
  /** Comma-separated admin email addresses */
  ADMIN_EMAILS: string;
  /** Optional bootstrap secret for creating the first admin */
  CREATE_ADMIN?: string;
}

// ---- Database row types (snake_case columns) ----

export interface UserRow {
  id: string;
  email: string;
  email_verified_at: string | null;
  totp_secret: string | null;
  totp_pending_secret: string | null;
  totp_enabled: number;
  handle: string;
  display_name: string;
  pronouns: string | null;
  gender_identity: string | null;
  bio: string | null;
  avatar_url: string | null;
  tier: string;
  status: string;
  invited_by_id: string | null;
  application_id: string | null;
  scheduled_deletion_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationRow {
  id: string;
  email: string;
  answers: string;
  status: string;
  reviewer_id: string | null;
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface InviteCodeRow {
  code: string;
  issuer_id: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  note: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  organizer_id: string;
  title: string;
  slug: string;
  category: string;
  format: string;
  description: string;
  cover_url: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  city: string | null;
  precise_addr: string | null;
  online_url: string | null;
  capacity: number | null;
  require_approval: number;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  custom_questions: string | null;
  visibility: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface RegistrationRow {
  id: string;
  event_id: string;
  user_id: string;
  answers: string | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommentRow {
  id: string;
  event_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  is_hidden: number;
  hidden_reason: string | null;
  created_at: string;
}

export interface ContactMethodRow {
  id: string;
  user_id: string;
  kind: string;
  value: string;
  label: string | null;
  visibility: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ContactRequestRow {
  id: string;
  requester_id: string;
  target_id: string;
  contact_id: string | null;
  reason: string;
  status: string;
  decided_at: string | null;
  created_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  resolved_note: string | null;
  resolved_by_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface BlockRow {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  payload: string;
  read_at: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string;
  meta: string | null;
  created_at: string;
}

export interface MagicTokenRow {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used: number;
  created_at: string;
}

// ---- Hono context variable types ----

export type Variables = {
  userId: string;
  userTier: string;
  userHandle: string;
};
