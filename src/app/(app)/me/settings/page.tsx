"use client";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ExportButton } from "./ExportButton";
import { DeleteAccountForm } from "./DeleteAccountForm";
import { ChangeEmailForm } from "./ChangeEmailForm";

export default function MeSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader eyebrow="设置" title="账号与隐私" />

      <Card>
        <CardHeader>
          <CardTitle>修改邮箱</CardTitle>
          <CardDescription>使用当前 TOTP 验证码确认后可变更登录邮箱。</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangeEmailForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>导出我的数据</CardTitle>
          <CardDescription>
            下载属于你的所有数据（主页、联系方式、报名记录、评论等）的 JSON。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>拉黑列表</CardTitle>
          <CardDescription>管理你已经拉黑的成员。</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/me/blocks" className="text-sm text-trans-blue-deep hover:underline">
            前往拉黑列表 →
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">注销账号</CardTitle>
          <CardDescription>
            注销后账号将被标记为待删除，30 天内可联系管理员恢复，超过期限后将永久删除。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
