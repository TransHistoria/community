"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { getQueryRoute, toQueryRoute } from "@/lib/query-routing";
import AuthFrame from "../(auth)/AuthFrame";
import AboutPageClient from "./about/AboutPageClient";
import ApplyPageClient from "../(auth)/apply/ApplyPageClient";
import ApplyPendingPageClient from "../(auth)/apply/pending/ApplyPendingPageClient";
import SignInPageClient from "../(auth)/sign-in/SignInPageClient";
import CheckEmailPageClient from "../(auth)/sign-in/check-email/CheckEmailPageClient";
import VerifySignInPageClient from "../(auth)/sign-in/verify/VerifySignInPageClient";
import EventsPage from "../(app)/events/page";
import NewEventPage from "../(app)/events/new/page";
import MeOverviewPage from "../(app)/me/page";
import MeProfilePage from "../(app)/me/profile/page";
import MeSettingsPage from "../(app)/me/settings/page";
import MeContactsPage from "../(app)/me/contacts/page";
import MeContactRequestsPage from "../(app)/me/contact-requests/page";
import MeRegistrationsPage from "../(app)/me/registrations/page";
import MeInvitesPage from "../(app)/me/invites/page";
import MeBlocksPage from "../(app)/me/blocks/page";
import MeDraftsPage from "../(app)/me/drafts/page";
import MeBookmarksPage from "../(app)/me/bookmarks/page";
import NotificationsPage from "../(app)/notifications/page";
import PostsPage from "../(app)/posts/page";
import NewPostPage from "../(app)/posts/new/page";
import PostDetailPageClient from "../(app)/posts/PostDetailPageClient";
import EditPostPageClient from "../(app)/posts/EditPostPageClient";
import AdminLayout from "../admin/layout";
import AdminApplicationsPage from "../admin/applications/page";
import AdminPostsPage from "../admin/posts/page";
import AdminReportsPage from "../admin/reports/page";
import AdminUsersPage from "../admin/users/page";
import AdminAuditPage from "../admin/audit/page";
import AdminSettingsPage from "../admin/settings/page";
import SignUpPageClient from "../(auth)/sign-up/SignUpPageClient";
import EventDetailPageClient from "../(app)/events/[slug]/EventDetailPageClient";
import ManageEventPageClient from "../(app)/events/[slug]/manage/ManageEventPageClient";
import EditEventPageClient from "../(app)/events/[slug]/edit/EditEventPageClient";
import RegisterPageClient from "../(app)/events/[slug]/register/RegisterPageClient";
import UserProfilePageClient from "../(app)/u/[handle]/UserProfilePageClient";

export default function HomePage() {
  return (
    <React.Suspense>
      <HomePageInner />
    </React.Suspense>
  );
}

function HomePageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryRoutePath = React.useMemo(() => getQueryRoute(searchParams).path, [searchParams]);

  const isEventManage = /^\/events\/[^/]+\/manage$/.test(queryRoutePath);
  const isEventEdit = /^\/events\/[^/]+\/edit$/.test(queryRoutePath);
  const isEventRegister = /^\/events\/[^/]+\/register$/.test(queryRoutePath);
  const isEventDetail = /^\/events\/[^/]+$/.test(queryRoutePath);
  const isUserDetail = /^\/u\/[^/]+$/.test(queryRoutePath);
  const isEventsIndex = queryRoutePath === "/events";
  const isLegacyEventsEdit = queryRoutePath === "/events/edit";
  const isLegacyEventsManage = queryRoutePath === "/events/manage";
  const isLegacyEventsRegister = queryRoutePath === "/events/register";
  const isEventsNew = queryRoutePath === "/events/new";
  const isPostsIndex = queryRoutePath === "/posts";
  const isPostNew = queryRoutePath === "/posts/new";
  const isPostEdit = /^\/posts\/[^/]+\/edit$/.test(queryRoutePath);
  const isPostDetail = /^\/posts\/[^/]+$/.test(queryRoutePath);
  const isLegacyUserDetail = queryRoutePath === "/u";
  const isMeIndex = queryRoutePath === "/me";
  const isMeProfile = queryRoutePath === "/me/profile";
  const isMeSettings = queryRoutePath === "/me/settings";
  const isMeContacts = queryRoutePath === "/me/contacts";
  const isMeContactRequests = queryRoutePath === "/me/contact-requests";
  const isMeRegistrations = queryRoutePath === "/me/registrations";
  const isMeInvites = queryRoutePath === "/me/invites";
  const isMeBlocks = queryRoutePath === "/me/blocks";
  const isMeDrafts = queryRoutePath === "/me/drafts";
  const isMeBookmarks = queryRoutePath === "/me/bookmarks";
  const isNotifications = queryRoutePath === "/notifications";
  const isAdminIndex = queryRoutePath === "/admin";
  const isAdminApplications = queryRoutePath === "/admin/applications";
  const isAdminPosts = queryRoutePath === "/admin/posts";
  const isAdminReports = queryRoutePath === "/admin/reports";
  const isAdminUsers = queryRoutePath === "/admin/users";
  const isAdminAudit = queryRoutePath === "/admin/audit";
  const isAdminSettings = queryRoutePath === "/admin/settings";
  const isAbout = queryRoutePath === "/about";
  const isApply = queryRoutePath === "/apply";
  const isApplyPending = queryRoutePath === "/apply/pending";
  const isSignIn = queryRoutePath === "/sign-in";
  const isSignInCheckEmail = queryRoutePath === "/sign-in/check-email";
  const isSignInVerify = queryRoutePath === "/sign-in/verify";
  const isSignUp = queryRoutePath === "/sign-up";

  if (isAbout) return <AboutPageClient />;
  if (isApply) {
    return (
      <AuthFrame>
        <ApplyPageClient />
      </AuthFrame>
    );
  }
  if (isApplyPending) {
    return (
      <AuthFrame>
        <ApplyPendingPageClient />
      </AuthFrame>
    );
  }
  if (isSignIn) {
    return (
      <AuthFrame>
        <SignInPageClient />
      </AuthFrame>
    );
  }
  if (isSignInCheckEmail) {
    return (
      <AuthFrame>
        <CheckEmailPageClient />
      </AuthFrame>
    );
  }
  if (isSignInVerify) {
    return (
      <AuthFrame>
        <VerifySignInPageClient />
      </AuthFrame>
    );
  }
  if (isEventsIndex) return <EventsPage />;
  if (isEventsNew) return <NewEventPage />;
  if (isPostsIndex) return <PostsPage />;
  if (isPostNew) return <NewPostPage />;
  if (isPostEdit) return <EditPostPageClient />;
  if (isPostDetail) return <PostDetailPageClient />;
  if (isLegacyEventsManage) return <ManageEventPageClient />;
  if (isLegacyEventsEdit) return <EditEventPageClient />;
  if (isLegacyEventsRegister) return <RegisterPageClient />;
  if (isEventManage) return <ManageEventPageClient />;
  if (isEventEdit) return <EditEventPageClient />;
  if (isEventRegister) return <RegisterPageClient />;
  if (isEventDetail) return <EventDetailPageClient />;
  if (isMeIndex) return <MeOverviewPage />;
  if (isMeProfile) return <MeProfilePage />;
  if (isMeSettings) return <MeSettingsPage />;
  if (isMeContacts) return <MeContactsPage />;
  if (isMeContactRequests) return <MeContactRequestsPage />;
  if (isMeRegistrations) return <MeRegistrationsPage />;
  if (isMeInvites) return <MeInvitesPage />;
  if (isMeBlocks) return <MeBlocksPage />;
  if (isMeDrafts) return <MeDraftsPage />;
  if (isMeBookmarks) return <MeBookmarksPage />;
  if (isNotifications) return <NotificationsPage />;
  if (isAdminIndex || isAdminApplications) {
    return (
      <AdminLayout>
        <AdminApplicationsPage />
      </AdminLayout>
    );
  }
  if (isAdminPosts) {
    return (
      <AdminLayout>
        <AdminPostsPage />
      </AdminLayout>
    );
  }
  if (isAdminReports) {
    return (
      <AdminLayout>
        <AdminReportsPage />
      </AdminLayout>
    );
  }
  if (isAdminUsers) {
    return (
      <AdminLayout>
        <AdminUsersPage />
      </AdminLayout>
    );
  }
  if (isAdminAudit) {
    return (
      <AdminLayout>
        <AdminAuditPage />
      </AdminLayout>
    );
  }
  if (isAdminSettings) {
    return (
      <AdminLayout>
        <AdminSettingsPage />
      </AdminLayout>
    );
  }
  if (isSignUp) {
    return (
      <AuthFrame>
        <SignUpPageClient />
      </AuthFrame>
    );
  }
  if (isLegacyUserDetail) return <UserProfilePageClient />;
  if (isUserDetail) return <UserProfilePageClient />;

  return (
    <div className="space-y-24 py-6 md:py-12">
      {/* Hero */}
      <section className="max-w-2xl mx-auto text-center space-y-8">
        <Badge variant="pink" className="rounded-full">
          私域 · 邀请制
        </Badge>
        <h1 className="font-serif text-display-lg text-balance leading-[1.05] tracking-tight">
          为社群而建的空间。
        </h1>
        <p className="text-lg text-ink-muted leading-relaxed max-w-lg mx-auto">
          一个让我们彼此看见，也彼此保护的地方。
        </p>
        <p className="text-lg text-ink-muted leading-relaxed max-w-lg mx-auto">
          让相遇更安全，让资源在社群里流动。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          {user ? (
            <Button size="lg" asChild>
              <Link href={toQueryRoute("/posts")}>逛逛广场</Link>
            </Button>
          ) : (
            <>
              <Button size="lg" asChild>
                <Link href={toQueryRoute("/sign-up")}>加入社群</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href={toQueryRoute("/sign-in")}>已有账号</Link>
              </Button>
            </>
          )}
        </div>
        <p className="text-xs text-ink-subtle">
          注册需要邀请码或通过申请审核。我们不收集真实姓名。
        </p>
      </section>
    </div>
  );
}


