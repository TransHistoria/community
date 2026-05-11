"use client";
import * as React from "react";
import { api, type SessionUser } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "./ProfileForm";

export default function MeProfilePage() {
  const { user } = useAuth();
  const [initial, setInitial] = React.useState<{
    handle: string;
    displayName: string;
    pronouns: string;
    genderIdentity: string;
    bio: string;
    avatarUrl: string | null;
  } | null>(null);

  React.useEffect(() => {
    api.auth.me().then((u: SessionUser) => {
      setInitial({
        handle: u.handle,
        displayName: u.displayName,
        pronouns: u.pronouns ?? "",
        genderIdentity: u.genderIdentity ?? "",
        bio: u.bio ?? "",
        avatarUrl: u.avatarUrl ?? null,
      });
    });
  }, []);

  if (!user || !initial) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow="我的主页"
        title="编辑主页"
        description="这些信息会展示给已登录的社群成员。所有项都可以随时修改。"
      />
      <ProfileForm initial={initial} />
    </div>
  );
}
