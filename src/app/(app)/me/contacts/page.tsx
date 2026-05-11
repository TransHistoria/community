"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { ContactsManager } from "./ContactsManager";

export default function MeContactsPage() {
  const [contacts, setContacts] = React.useState<unknown[]>([]);

  const load = React.useCallback(() => {
    api.users.myContacts().then(({ contacts: c }) => setContacts(c));
  }, []);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow="我的资料"
        title="联系方式"
        description="管理你愿意展示给他人的联系方式，每一项都可以独立设置可见范围。"
      />
      <ContactsManager contacts={contacts} onRefresh={load} />
    </div>
  );
}
