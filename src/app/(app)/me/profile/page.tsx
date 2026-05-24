"use client";
import * as React from "react";
import { api, type SessionUser } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "./ProfileForm";
import { ContactsManager } from "../contacts/ContactsManager";

export default function MeProfilePage() {
  const { user } = useAuth();
  const [contacts, setContacts] = React.useState<unknown[]>([]);
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

  const loadContacts = React.useCallback(() => {
    api.users.myContacts().then((res: { contacts: unknown[] }) => setContacts(res.contacts));
  }, []);

  React.useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  if (!user || !initial) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow="我的主页"
        title="编辑主页与联系方式"
        description="在同一页面管理你的个人信息与联系方式。"
      />
      <ProfileForm initial={initial} />
      <ContactsManager contacts={contacts} onRefresh={loadContacts} />
    </div>
  );
}
