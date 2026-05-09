import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplyForm } from "./ApplyForm";

export const metadata = { title: "入站申请" };

export default function ApplyPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>入站申请</CardTitle>
        <CardDescription>
          以下问题用于帮助管理员理解你的来意。我们不会公开你的回答，也不会因此评判你的身份。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ApplyForm />
        <div className="text-center text-sm text-ink-muted pt-6 mt-6 border-t border-border">
          有邀请码？
          <Link
            href="/sign-up"
            className="ml-1 text-trans-blue-deep hover:underline"
          >
            走邀请码通道
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
