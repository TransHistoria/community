import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "./SignInForm";
import Link from "next/link";

export const metadata = { title: "登录" };

export default function SignInPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>登录</CardTitle>
        <CardDescription>输入邮箱和认证器中的 6 位验证码登录。无需密码。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SignInForm callbackUrl="/me" />
        <div className="text-center text-sm text-ink-muted pt-2">
          还没有账号？
          <Link href="/sign-up" className="ml-1 text-trans-blue-deep hover:underline">
            加入社群
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
