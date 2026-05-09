// Centralised env access. Don't read process.env directly elsewhere.

function required(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v && v.length > 0) return v;
  if (fallback !== undefined) return fallback;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`Missing required env: ${name}`);
  }
  return "";
}

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

function list(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const env = {
  app: {
    name: required("APP_NAME", "跨性别社群"),
    locale: required("APP_LOCALE", "zh-CN"),
    adminEmails: list("ADMIN_EMAILS"),
    enabledCategories: list("ENABLED_CATEGORIES"),
  },
  auth: {
    secret: required("AUTH_SECRET", "dev-only-insecure-secret-change-me"),
    url: optional("AUTH_URL"),
  },
  db: {
    url: required("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/trans_community"),
  },
  email: {
    from: required("EMAIL_FROM", "Trans Community <noreply@example.com>"),
    resendKey: optional("RESEND_API_KEY"),
    smtp: {
      host: optional("SMTP_HOST"),
      port: optional("SMTP_PORT"),
      user: optional("SMTP_USER"),
      pass: optional("SMTP_PASS"),
    },
  },
  storage: {
    driver: required("STORAGE_DRIVER", "local") as "local" | "s3",
    s3: {
      endpoint: optional("S3_ENDPOINT"),
      region: required("S3_REGION", "auto"),
      bucket: optional("S3_BUCKET"),
      accessKey: optional("S3_ACCESS_KEY"),
      secretKey: optional("S3_SECRET_KEY"),
      publicUrl: optional("S3_PUBLIC_URL"),
    },
  },
};
