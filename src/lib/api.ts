// Typed API client — all communication with the Cloudflare Worker backend.
// All mutations that were previously Next.js server actions are now fetch()
// calls to the worker.

const LEGACY_WORKER_URL = "https://transcommunity.cyanmint.workers.dev";

function normalizeUrl(url?: string): string {
  return (url || "").trim().replace(/\/$/, "");
}

const CONFIGURED_BASE_URL = normalizeUrl(process.env.NEXT_PUBLIC_API_URL);
const CONFIGURED_FALLBACK_BASE_URL = normalizeUrl(process.env.NEXT_PUBLIC_API_FALLBACK_URL);
const FRONTEND_DEBUG = process.env.NEXT_PUBLIC_DEBUG === "1";

function resolveBaseUrls(): string[] {
  const candidates: string[] = [CONFIGURED_BASE_URL, CONFIGURED_FALLBACK_BASE_URL, LEGACY_WORKER_URL];
  return candidates.filter((url, idx) => !!url && candidates.indexOf(url) === idx);
}

function getPrimaryBaseUrl(): string {
  return resolveBaseUrls()[0] ?? LEGACY_WORKER_URL;
}

// ---- Low-level fetch helper ----

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tc_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const baseUrls = resolveBaseUrls();
  let lastNetworkError: unknown = null;
  let lastApiError: ApiError | null = null;

  for (const baseUrl of baseUrls) {
    try {
      const res = await fetch(`${baseUrl}${path}`, { ...options, headers });

      if (!res.ok) {
        let message = res.statusText;
        let detail: unknown;
        try {
          const body = await res.json();
          if (body && typeof body === "object") {
            const shaped = body as { error?: string; reason?: string; detail?: unknown; debug?: unknown };
            if (shaped.error) message = shaped.error;
            detail = body;
            if (FRONTEND_DEBUG) {
              const reason = typeof shaped.reason === "string" ? shaped.reason : undefined;
              const debugMessage = JSON.stringify(body, null, 2);
              message = reason && reason !== message ? `${message}: ${reason}` : message;
              message = `${message}\n${debugMessage}`;
              console.error("API request rejected", { path, status: res.status, body });
            }
          }
        } catch {}
        const apiError = new ApiError(res.status, message, detail);
        // Wrong-host fallbacks often return 404/405 for /api/*; keep trying.
        if (res.status === 404 || res.status === 405) {
          lastApiError = apiError;
          continue;
        }
        throw apiError;
      }

      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      lastNetworkError = err;
    }
  }

  if (lastApiError) throw lastApiError;
  throw lastNetworkError instanceof Error
    ? lastNetworkError
    : new Error("请求失败，请检查网络连接");
}

const get = <T>(path: string) => request<T>(path, { method: "GET" });
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined });
const del = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "DELETE", body: body !== undefined ? JSON.stringify(body) : undefined });

// ---- Shared types ----

export interface SessionUser {
  id: string;
  handle: string;
  displayName: string;
  tier: string;
  avatarUrl?: string | null;
  email?: string;
  pronouns?: string | null;
  genderIdentity?: string | null;
  bio?: string | null;
  createdAt?: string;
  authMode?: string;
  passwordSet?: boolean;
  totpEnabled?: boolean;
}

export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  format: string;
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
  organizer_id: string;
  organizer_handle: string;
  organizer_name: string;
  organizer_avatar?: string | null;
  reg_count?: number;
  registration?: { id: string; status: string; createdAt: string } | null;
  canEdit?: boolean;
  canRegister?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  answers: string | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  handle?: string;
  display_name?: string;
  avatar_url?: string | null;
  tier?: string;
  title?: string;
  slug?: string;
  start_at?: string;
  end_at?: string;
  format?: string;
  city?: string | null;
}

export interface Comment {
  id: string;
  event_id: string | null;
  post_id: string | null;
  author_id: string;
  body: string;
  parent_id: string | null;
  is_hidden: number;
  hidden_reason: string | null;
  is_bot: number;
  created_at: string;
  author_handle: string;
  author_name: string;
  author_avatar: string | null;
}

export interface ModerationDecision {
  verdict: "pass" | "flag" | "reject";
  reason: string;
  section: "POST" | "MEDICAL" | "RESOURCE" | "EVENT";
  categories: string[];
  classifier: "LLM" | "FALLBACK" | "KEYWORD" | "MANUAL";
  raw?: string;
}

export interface Post {
  id: string;
  author_id: string;
  section: "POST" | "QUESTION" | "OFFLINE_MEETUP" | "MEDICAL" | "RESOURCE" | "REFLECTION";
  title: string;
  body: string;
  tags: string;
  hospital: string | null;
  doctor: string | null;
  city: string | null;
  resource_kind: string | null;
  cover_url: string | null;
  visibility: string;
  status: "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "HIDDEN" | "DRAFT";
  moderation_verdict: string | null;
  moderation_reason: string | null;
  moderation_categories: string | null;
  moderation_raw: string | null;
  moderation_classifier: string | null;
  moderated_at: string | null;
  reviewed_by_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  author_handle: string;
  author_name: string;
  author_avatar?: string | null;
  comment_count?: number;
  /** Set on list endpoint (snake_case for SQL alias). */
  like_count?: number;
  /** Set on detail endpoint (computed at request time). */
  likeCount?: number;
  canEdit?: boolean;
  liked?: boolean;
  bookmarked?: boolean;
  subscribed?: boolean;
}

export interface Subscription {
  kind: "AUTHOR" | "TAG";
  ref: string;
  created_at: string;
}

export interface ContactMethod {
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

export interface ContactRequest {
  id: string;
  requester_id: string;
  target_id: string;
  contact_id: string | null;
  reason: string;
  status: string;
  decided_at: string | null;
  created_at: string;
  requester_handle?: string;
  requester_name?: string;
  requester_avatar?: string | null;
}

export interface InviteCode {
  code: string;
  issuer_id: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  note: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: string;
  payload: string;
  read_at: string | null;
  created_at: string;
}

export interface Application {
  id: string;
  email: string;
  answers: string;
  status: string;
  reviewer_id: string | null;
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewer_handle?: string | null;
}

export interface UserProfile {
  id: string;
  handle: string;
  displayName: string;
  pronouns: string | null;
  genderIdentity: string | null;
  bio: string | null;
  avatarUrl: string | null;
  tier: string;
  createdAt: string;
  contacts: ContactMethod[];
  isSelf: boolean;
}

// ---- API namespaces ----

type EventUpsertData = {
  title: string;
  description: string;
  category: string;
  format: string;
  coverUrl?: string;
  startAt: string | Date;
  endAt: string | Date;
  timezone?: string;
  city?: string;
  preciseAddr?: string;
  onlineUrl?: string;
  capacity?: number;
  requireApproval?: boolean;
  registrationOpensAt?: string | Date | null;
  registrationClosesAt?: string | Date | null;
  customQuestions?: unknown[];
  visibility?: string;
};

export const api = {
  // Auth
  auth: {
    sendLink: (email: string) =>
      post<{ ok: boolean }>("/api/auth/send-link", { email }),

    registerTotp: (email: string) =>
      post<{ ok: boolean }>("/api/auth/register-totp", { email }),

    loginTotp: (email: string, code: string) =>
      post<{ ok: boolean; token: string; user: SessionUser }>("/api/auth/login-totp", {
        email,
        code,
      }),

    loginPassword: (email: string, password: string, code?: string) =>
      post<{ ok: boolean; token: string; user: SessionUser }>("/api/auth/login-password", {
        email,
        password,
        ...(code ? { code } : {}),
      }),

    resetPassword: (email: string) =>
      post<{ ok: boolean }>("/api/auth/reset-password", { email }),

    updateSecurity: (opts: {
      currentPassword?: string;
      totpCode?: string;
      newPassword?: string;
      authMode?: string;
    }) => patch<{ ok: boolean }>("/api/auth/security", opts),

    changeEmail: (newEmail: string, code: string) =>
      post<{ ok: boolean }>("/api/auth/change-email", { newEmail, code }),

    verify: (token: string) =>
      post<{ ok: boolean; token: string; user: SessionUser }>(
        "/api/auth/verify",
        { token },
      ),

    verifyInvite: (email: string, code: string, turnstileToken?: string) =>
      post<{ ok: boolean }>("/api/auth/verify-invite", { email, code, turnstileToken }),

    me: () => get<SessionUser>("/api/auth/me"),

    signOut: () => post<{ ok: boolean }>("/api/auth/sign-out"),
  },

  // Events
  events: {
    list: (params?: {
      category?: string;
      format?: string;
      city?: string;
      q?: string;
      page?: number;
    }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {})
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => [k, String(v)]),
      ).toString();
      return get<{ events: Event[] }>(`/api/activities${qs ? `?${qs}` : ""}`);
    },

    get: (slug: string) => get<{ event: Event }>(`/api/activities/${slug}`),

    create: (data: EventUpsertData, asDraft = false) =>
      post<{ ok: boolean; slug: string; status?: string }>(`/api/activities${asDraft ? "?draft=1" : ""}`, data),

    update: (
      id: string,
      data: Partial<EventUpsertData> & { adminStatus?: "DRAFT" | "PUBLISHED" },
      asDraft = false,
    ) =>
      patch<{ ok: boolean; status?: string }>(`/api/activities/${id}${asDraft ? "?draft=1" : ""}`, data),

    cancel: (id: string) => del<{ ok: boolean }>(`/api/activities/${id}`),

    // Registrations
    listRegistrations: (eventId: string) =>
      get<{ registrations: Registration[] }>(`/api/activities/${eventId}/registrations`),

    register: (eventId: string, answers?: Record<string, unknown>) =>
      post<{ ok: boolean; status: string }>(`/api/activities/${eventId}/registrations`, { answers }),

    decideRegistration: (regId: string, decision: string) =>
      patch<{ ok: boolean }>(`/api/activities/registrations/${regId}`, { decision }),

    cancelRegistration: (regId: string) =>
      del<{ ok: boolean }>(`/api/activities/registrations/${regId}`),

    // Comments
    listComments: (eventId: string) =>
      get<{ comments: Comment[] }>(`/api/activities/${eventId}/comments`),

    postComment: (eventId: string, body: string, parentId?: string) =>
      post<{ ok: boolean }>(`/api/activities/${eventId}/comments`, { body, parentId }),

    hideComment: (commentId: string) =>
      patch<{ ok: boolean }>(`/api/activities/comments/${commentId}/hide`),
  },

  // Posts — single "广场" feed. Users only supply title/body/visibility;
  // the backend LLM derives section/tags/moderation and the response
  // never includes moderation details.
  posts: {
    list: (params?: {
      tag?: string;
      hospital?: string;
      doctor?: string;
      city?: string;
      q?: string;
      page?: number;
    }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {})
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => [k, String(v)]),
      ).toString();
      return get<{ posts: Post[]; hasMore?: boolean; nextPage?: number }>(
        `/api/posts${qs ? `?${qs}` : ""}`,
      );
    },

    get: (id: string) => get<{ post: Post }>(`/api/posts/${id}`),

    create: (data: { title: string; body: string; section: string; visibility?: string }, asDraft = false) =>
      post<{ ok: boolean; id: string; status: string }>(
        `/api/posts${asDraft ? "?draft=1" : ""}`,
        data,
      ),

    update: (
      id: string,
      data: Partial<{ title: string; body: string; section: string; visibility: string }> & { adminStatus?: "DRAFT" | "PUBLISHED" },
      asDraft = false,
    ) =>
      patch<{ ok: boolean; status: string }>(`/api/posts/${id}${asDraft ? "?draft=1" : ""}`, data),

    remove: (id: string) => del<{ ok: boolean }>(`/api/posts/${id}`),

    listComments: (id: string, cursor?: string) => {
      const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      return get<{ comments: Comment[]; nextCursor?: string }>(
        `/api/posts/${id}/comments${qs}`,
      );
    },

    postComment: (id: string, body: string, parentId?: string) =>
      post<{ ok: boolean; id: string; hidden: boolean }>(`/api/posts/${id}/comments`, {
        body,
        parentId,
      }),

    deleteComment: (cid: string) =>
      del<{ ok: boolean }>(`/api/posts/comments/${cid}`),

    hideComment: (cid: string) =>
      patch<{ ok: boolean }>(`/api/posts/comments/${cid}/hide`),

    toggleLike: (id: string) =>
      post<{ liked: boolean }>(`/api/posts/${id}/like`),

    toggleBookmark: (id: string) =>
      post<{ bookmarked: boolean }>(`/api/posts/${id}/bookmark`),

    myBookmarks: () => get<{ posts: Post[] }>(`/api/posts/me/bookmarks`),

    myDrafts: () => get<{ posts: Post[] }>(`/api/posts/me/drafts`),
  },

  subscriptions: {
    list: () => get<{ subscriptions: Subscription[] }>("/api/users/me/subscriptions"),
    follow: (kind: "AUTHOR" | "TAG", ref: string) =>
      post<{ ok: boolean }>("/api/users/me/subscriptions", { kind, ref }),
    unfollow: (kind: "AUTHOR" | "TAG", ref: string) =>
      del<{ ok: boolean }>("/api/users/me/subscriptions", { kind, ref }),
  },

  // Users
  users: {
    getProfile: (handle: string) => get<UserProfile>(`/api/users/${handle}`),

    updateMe: (data: {
      displayName?: string;
      pronouns?: string | null;
      genderIdentity?: string | null;
      bio?: string | null;
      avatarUrl?: string | null;
    }) => patch<{ ok: boolean }>("/api/users/me", data),

    myRegistrations: () =>
      get<{ registrations: Registration[] }>("/api/users/me/registrations"),

    exportMe: () => get<Record<string, unknown>>("/api/users/me/export"),

    // Contacts
    myContacts: () => get<{ contacts: ContactMethod[] }>("/api/users/me/contacts"),

    addContact: (data: {
      kind: string;
      value: string;
      label?: string;
      visibility?: string;
    }) => post<{ ok: boolean; id: string }>("/api/users/me/contacts", data),

    updateContact: (
      id: string,
      data: { kind?: string; value?: string; label?: string | null; visibility?: string },
    ) => patch<{ ok: boolean }>(`/api/users/me/contacts/${id}`, data),

    deleteContact: (id: string) =>
      del<{ ok: boolean }>(`/api/users/me/contacts/${id}`),

    // Contact requests
    myContactRequests: () =>
      get<{ requests: ContactRequest[] }>("/api/users/me/contact-requests"),

    sendContactRequest: (
      handle: string,
      data: { contactId?: string; reason: string },
    ) =>
      post<{ ok: boolean; id: string }>(
        `/api/users/${handle}/contact-requests`,
        data,
      ),

    decideContactRequest: (reqId: string, decision: "APPROVED" | "DECLINED") =>
      patch<{ ok: boolean }>(`/api/users/me/contact-requests/${reqId}`, {
        decision,
      }),

    // Invites
    myInvites: () => get<{ invites: InviteCode[] }>("/api/users/me/invites"),

    createInvite: (data: { note?: string; expiresInDays?: number }) =>
      post<{ ok: boolean; code: string }>("/api/users/me/invites", data),

    // Blocks
    myBlocks: () => get<{ blocks: unknown[] }>("/api/users/me/blocks"),

    block: (handle: string) =>
      post<{ ok: boolean }>(`/api/users/${handle}/block`),

    unblock: (handle: string) =>
      del<{ ok: boolean }>(`/api/users/${handle}/block`),
  },

  // Applications
  applications: {
    submit: (email: string, answers?: Record<string, unknown>, turnstileToken?: string) =>
      post<{ ok: boolean }>("/api/applications", { email, answers, turnstileToken }),

    checkStatus: (email: string) =>
      get<{ application: { id: string; status: string; created_at: string } | null }>(
        `/api/applications/mine?email=${encodeURIComponent(email)}`,
      ),

    // Admin
    list: (status = "PENDING") =>
      get<{ applications: Application[] }>(`/api/applications?status=${status}`),

    decide: (id: string, decision: "APPROVED" | "REJECTED", note?: string) =>
      patch<{ ok: boolean }>(`/api/applications/${id}`, { decision, note }),
  },

  // Notifications
  notifications: {
    list: (unreadOnly = false) =>
      get<{ notifications: Notification[] }>(
        `/api/notifications${unreadOnly ? "?unread=1" : ""}`,
      ),

    markRead: (ids?: string[]) =>
      post<{ ok: boolean }>("/api/notifications/mark-read", ids ? { ids } : {}),
  },

  // Admin
  admin: {
    listUsers: (params?: { tier?: string; status?: string; q?: string; page?: number }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {})
          .filter(([, v]) => v !== undefined && v !== "")
          .map(([k, v]) => [k, String(v)]),
      ).toString();
      return get<{ users: unknown[] }>(`/api/admin/users${qs ? `?${qs}` : ""}`);
    },

    setUserTier: (id: string, tier: string) =>
      patch<{ ok: boolean }>(`/api/admin/users/${id}`, { tier }),

    setUserStatus: (id: string, status: "ACTIVE" | "SUSPENDED") =>
      patch<{ ok: boolean }>(`/api/admin/users/${id}`, { status }),

    listReports: (status = "OPEN") =>
      get<{ reports: unknown[] }>(`/api/admin/reports?status=${status}`),

    resolveReport: (
      id: string,
      decision: "RESOLVED" | "DISMISSED",
      note?: string,
      hideTarget?: boolean,
    ) =>
      patch<{ ok: boolean }>(`/api/admin/reports/${id}`, {
        decision,
        note,
        hideTarget,
      }),

    auditLog: (params?: { actorId?: string; targetType?: string; page?: number }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString();
      return get<{ logs: unknown[] }>(`/api/admin/audit${qs ? `?${qs}` : ""}`);
    },

    sendTestEmail: (to?: string) =>
      post<{ ok: boolean }>("/api/admin/test-email", to ? { to } : {}),

    testTurnstile: (turnstileToken?: string) =>
      post<{ ok: boolean; enforced?: boolean; message?: string }>(
        "/api/admin/test-turnstile",
        turnstileToken ? { turnstileToken } : {},
      ),

    reinitializeUser: (userId: string) =>
      post<{ ok: boolean }>(`/api/admin/users/${userId}/reinitialize`, {}),

    setUserEmail: (userId: string, email: string) =>
      patch<{ ok: boolean }>(`/api/admin/users/${userId}/email`, { email }),

    // Posts moderation queue
    listPendingPosts: () => get<{ posts: Post[] }>(`/api/posts/admin/pending`),

    reviewPost: (id: string, decision: "APPROVE" | "REJECT" | "HIDE", note?: string) =>
      patch<{ ok: boolean; status: string }>(`/api/posts/${id}/review`, { decision, note }),
  },

  // Files
  files: {
    upload: (file: File, purpose: string): Promise<{ ok: boolean; url: string }> => {
      const token = getToken();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", purpose);
      return fetch(`${getPrimaryBaseUrl()}/api/files`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      }).then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new ApiError(res.status, body.error ?? res.statusText);
        }
        return res.json() as Promise<{ ok: boolean; url: string }>;
      });
    },
    url: (path: string): string => `${getPrimaryBaseUrl()}${path}`,
  },

  // Reports
  reports: {
    submit: (targetType: string, targetId: string, reason: string) =>
      post<{ ok: boolean }>("/api/reports", { targetType, targetId, reason }),
  },
};

export { ApiError };
