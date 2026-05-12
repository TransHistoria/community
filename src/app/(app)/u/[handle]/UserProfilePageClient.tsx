"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api, type UserProfile } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canViewContact } from "@/lib/access";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TierBadge } from "@/components/user/TierBadge";
import { CONTACT_KIND_LABEL, VISIBILITY_SHORT } from "@/components/user/contact-config";
import { formatDate } from "@/lib/utils";
import { Lock, Flag } from "lucide-react";
import { ContactRequestButton } from "./ContactRequestButton";
import { BlockButton } from "./BlockButton";
import { ReportButton } from "@/components/moderation/ReportButton";
import { ProfileMarkdown } from "@/components/user/ProfileMarkdown";
import { toQueryRoute } from "@/lib/query-routing";

export default function UserProfilePageClient() {
  const { handle } = useParams<{ handle: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!handle) return;
    api.users.getProfile(handle).then(setProfile).catch(() => setNotFound(true));
  }, [handle]);

  if (notFound) return <p className="text-ink-muted">用户不存在。</p>;
  if (!profile) return null;

  const isSelf = profile.isSelf;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row gap-6 sm:items-start">
        <Avatar className="h-24 w-24 ring-2 ring-border">
          {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={profile.displayName} /> : null}
          <AvatarFallback className="text-2xl">{profile.displayName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-serif text-h1 tracking-tight">{profile.displayName}</h1>
              <TierBadge tier={profile.tier} />
            </div>
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              <span>@{profile.handle}</span>
              {profile.pronouns ? <span>· {profile.pronouns}</span> : null}
              {profile.genderIdentity ? <span>· {profile.genderIdentity}</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-subtle">
            <span>加入于 {formatDate(new Date(profile.createdAt))}</span>
          </div>
          {!isSelf && user ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <ReportButton targetType="USER" targetId={profile.id}>
                <Flag className="h-3.5 w-3.5" />
                举报
              </ReportButton>
              <BlockButton targetHandle={profile.handle} />
            </div>
          ) : null}
          {isSelf ? (
            <Button asChild size="sm" variant="outline">
              <Link href={toQueryRoute("/me/profile")}>编辑主页</Link>
            </Button>
          ) : null}
        </div>
      </header>

      {profile.bio ? (
        <Card>
          <CardContent className="pt-6">
            <ProfileMarkdown source={profile.bio} />
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-serif text-h2 tracking-tight">联系方式</h2>
        {profile.contacts.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {isSelf ? "你还没有添加任何联系方式。" : "ta 暂时没有公开任何联系方式。"}
          </p>
        ) : (
          <ul className="space-y-2">
            {profile.contacts.map((c) => {
              const visible = canViewContact(user, profile.id, c, false);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      {c.label ?? CONTACT_KIND_LABEL[c.kind]}
                      <span className="ml-2 text-xs text-ink-subtle font-normal">
                        {CONTACT_KIND_LABEL[c.kind]}
                      </span>
                    </div>
                    <div className="text-sm">
                      {visible ? (
                        <span className="font-mono text-ink">{c.value}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-ink-muted">
                          <Lock className="h-3.5 w-3.5" />
                          {c.visibility === "HIDDEN_REQUEST"
                            ? "已隐藏，需申请查看"
                            : `${VISIBILITY_SHORT[c.visibility]}才可见`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{VISIBILITY_SHORT[c.visibility]}</Badge>
                    {!visible && c.visibility === "HIDDEN_REQUEST" && !isSelf && user ? (
                      <ContactRequestButton
                        targetHandle={profile.handle}
                        contactId={c.id}
                        contactLabel={c.label ?? CONTACT_KIND_LABEL[c.kind]}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
