import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InviteSignUpForm } from "./InviteSignUpForm";
import { Button } from "@/components/ui/button";

export const metadata = { title: "加入社群" };

export default function SignUpPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>加入社群</CardTitle>
        <CardDescription>
          有两种方式可以加入：使用邀请码，或者填写一份入站申请等待审核。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="invite" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="invite" className="flex-1">
              邀请码
            </TabsTrigger>
            <TabsTrigger value="apply" className="flex-1">
              申请审核
            </TabsTrigger>
          </TabsList>
          <TabsContent value="invite" className="space-y-4">
            <p className="text-sm text-ink-muted">
              使用社群成员发给你的邀请码加入。完成注册后会立即获得已认证身份。
            </p>
            <InviteSignUpForm />
          </TabsContent>
          <TabsContent value="apply" className="space-y-4">
            <p className="text-sm text-ink-muted">
              没有邀请码也没关系。填写一份简短的入站申请，由管理员人工审核。
              通过后我们会发一封邮件通知你。
            </p>
            <Button asChild className="w-full" size="lg">
              <Link href="/apply">开始填写申请</Link>
            </Button>
          </TabsContent>
        </Tabs>
        <div className="text-center text-sm text-ink-muted pt-6 mt-6 border-t border-border">
          已有账号？
          <Link
            href="/sign-in"
            className="ml-1 text-trans-blue-deep hover:underline"
          >
            登录
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
