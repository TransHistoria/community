import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateAdminForm } from "../sign-up/CreateAdminForm";

export const metadata = { title: "初始化管理员" };

export default function CreateAdminPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>初始化管理员</CardTitle>
        <CardDescription>
          仅用于首次部署。需要后端已配置 <code>CREATE_ADMIN</code> 密钥且当前尚无管理员账号。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <CreateAdminForm />
        <p className="text-xs text-ink-subtle text-center">
          已有账号？
          <Link href="/sign-in" className="ml-1 text-trans-blue-deep hover:underline">
            去登录
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
