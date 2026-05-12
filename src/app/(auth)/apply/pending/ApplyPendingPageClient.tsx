"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { toQueryRoute } from "@/lib/query-routing";

export default function ApplyPendingPageClient() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-trans-gradient-soft flex items-center justify-center">
          <Clock className="h-6 w-6 text-trans-blue-deep" />
        </div>
        <CardTitle>申请已提交</CardTitle>
        <CardDescription>
          管理员会人工审核你的申请，结果通过邮件通知你。
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-ink-muted space-y-4">
        <p>
          通常审核会在几天内完成。如果通过，你会收到一封邮件，
          点击其中的登录链接即可进入平台。
        </p>
        <p>
          如果暂时未通过，邮件里也会有简短说明。
          你随时可以稍后再次申请，或请社群成员为你发邀请码。
        </p>
        <div className="text-center pt-4">
          <Link href={toQueryRoute("/")} className="text-trans-blue-deep hover:underline">
            ← 返回首页
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
