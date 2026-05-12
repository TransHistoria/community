"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function CheckEmailPageClient() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-trans-gradient-soft flex items-center justify-center">
          <Mail className="h-6 w-6 text-trans-blue-deep" />
        </div>
        <CardTitle>请查收邮件</CardTitle>
        <CardDescription>
          我们已经把登录链接发到你的邮箱。点击邮件里的按钮即可登录。
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-ink-muted space-y-3 text-center">
        <p>没收到？请检查垃圾邮件夹，或几分钟后重试。</p>
        <p className="text-xs">链接 30 分钟内有效，仅限一次。</p>
      </CardContent>
    </Card>
  );
}
