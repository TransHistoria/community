import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInForm } from "./SignInForm";
import Link from "next/link";

export const metadata = { title: "登录" };

export default function SignInPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>登录</CardTitle>
        <CardDescription>填入邮箱，我们会发一封登录链接过去。</CardDescription>
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
