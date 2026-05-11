// Typed API client — all communication with the Cloudflare Worker backend.
// All mutations that were previously Next.js server actions are now fetch()
// calls to the worker.

const BASE_URL =
  (
    process.env.NEXT_PUBLIC_API_URL ??
    "https://transcommunity.cyanmint.workers.dev"
  ).replace(/\/$/, "");

// ---- Low-level fetch helper ----

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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
  event_id: string;
  author_id: string;
  body: string;
  parent_id: string | null;
  is_hidden: number;
  hidden_reason: string | null;
  created_at: string;
  author_handle: string;
  author_name: string;
  author_avatar: string | null;
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

export const api = {
  // Auth
  auth: {
    sendLink: (email: string) =>
      post<{ ok: boolean }>("/api/auth/send-link", { email }),

    verify: (token: string) =>
      post<{ ok: boolean; token: string; user: SessionUser }>(
        "/api/auth/verify",
        { token },
      ),

    verifyInvite: (email: string, code: string) =>
      post<{ ok: boolean }>("/api/auth/verify-invite", { email, code }),

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
      return get<{ events: Event[] }>(`/api/events${qs ? `?${qs}` : ""}`);
    },

    get: (slug: string) => get<{ event: Event }>(`/api/events/${slug}`),

    create: (data: {
      title: string;
      description: string;
      category: string;
      format: string;
      coverUrl?: string;
      startAt: string;
      endAt: string;
      timezone?: string;
      city?: string;
      preciseAddr?: string;
      onlineUrl?: string;
      capacity?: number;
      requireApproval?: boolean;
      registrationOpensAt?: string;
      registrationClosesAt?: string;
      customQuestions?: unknown[];
      visibility?: string;
    }) => post<{ ok: boolean; slug: string }>("/api/events", data),

    update: (id: string, data: Partial<Parameters<typeof api.events.create>[0]>) =>
      patch<{ ok: boolean }>(`/api/events/${id}`, data),

    cancel: (id: string) => del<{ ok: boolean }>(`/api/events/${id}`),

    // Registrations
    listRegistrations: (eventId: string) =>
      get<{ registrations: Registration[] }>(`/api/events/${eventId}/registrations`),

    register: (eventId: string, answers?: Record<string, unknown>) =>
      post<{ ok: boolean; status: string }>(`/api/events/${eventId}/registrations`, { answers }),

    decideRegistration: (regId: string, decision: string) =>
      patch<{ ok: boolean }>(`/api/events/registrations/${regId}`, { decision }),

    cancelRegistration: (regId: string) =>
      del<{ ok: boolean }>(`/api/events/registrations/${regId}`),

    // Comments
    listComments: (eventId: string) =>
      get<{ comments: Comment[] }>(`/api/events/${eventId}/comments`),

    postComment: (eventId: string, body: string, parentId?: string) =>
      post<{ ok: boolean }>(`/api/events/${eventId}/comments`, { body, parentId }),

    hideComment: (commentId: string) =>
      patch<{ ok: boolean }>(`/api/events/comments/${commentId}/hide`),
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
    submit: (email: string, answers?: Record<string, unknown>) =>
      post<{ ok: boolean }>("/api/applications", { email, answers }),

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
  },

  // Reports
  reports: {
    submit: (targetType: string, targetId: string, reason: string) =>
      post<{ ok: boolean }>("/api/reports", { targetType, targetId, reason }),
  },
};

export { ApiError };
