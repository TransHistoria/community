import UserProfilePageClient from "./UserProfilePageClient";

export function generateStaticParams() {
  return [{ handle: "placeholder" }];
}

export default function UserProfilePage() {
  return <UserProfilePageClient />;
}
