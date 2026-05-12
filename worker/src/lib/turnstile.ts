import type { Env } from "@/types";

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(
  env: Pick<Env, "TURNSTILE_SECRET_KEY">,
  token?: string,
  remoteIp?: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = (env.TURNSTILE_SECRET_KEY ?? "").trim();
  if (!secret) return { ok: true };
  if (!token) return { ok: false, error: "请完成人机验证" };

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) return { ok: false, error: "人机验证服务不可用，请稍后重试" };
    const payload = (await res.json()) as TurnstileResponse;
    if (!payload.success) return { ok: false, error: "人机验证失败，请重试" };
    return { ok: true };
  } catch {
    return { ok: false, error: "人机验证失败，请稍后重试" };
  }
}

