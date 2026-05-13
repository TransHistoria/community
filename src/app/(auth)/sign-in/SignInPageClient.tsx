"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "./SignInForm";
import { toQueryRoute } from "@/lib/query-routing";

export default function SignInPageClient() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>登录</CardTitle>
        <CardDescription>使用密码或认证器 TOTP 验证码登录。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignInForm callbackUrl={toQueryRoute("/me")} />
        <div className="text-center text-sm text-ink-muted pt-2">
          还没有账号？
          <Link href={toQueryRoute("/sign-up")} className="ml-1 text-trans-blue-deep hover:underline">
            加入社群
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
