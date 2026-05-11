"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export function VerifyMagicLinkClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [status, setStatus] = React.useState<"loading" | "error">("loading");
  const [message, setMessage] = React.useState("正在验证登录链接…");

  React.useEffect(() => {
    const token = searchParams.get("token")?.trim();
    if (!token) {
      setStatus("error");
      setMessage("缺少登录令牌，请重新请求登录邮件。");
      return;
    }

    let cancelled = false;
    api.auth
      .verify(token)
      .then((res) => {
        if (cancelled) return;
        login(res.token, res.user);
        router.replace("/me");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "登录链接无效或已过期。");
      });

    return () => {
      cancelled = true;
    };
  }, [login, router, searchParams]);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>验证登录链接</CardTitle>
        <CardDescription>
          这是旧版邮箱登录链接的兼容页面。若验证成功，将自动跳转。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-ink-muted">{message}</p>
        {status === "error" ? (
          <Button asChild>
            <Link href="/sign-in">返回登录页</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
