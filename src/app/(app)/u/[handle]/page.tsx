import UserProfilePageClient from "./UserProfilePageClient";

export async function generateStaticParams() {
  return [{ handle: "placeholder" }];
}

export default function UserProfilePage() {
  return <UserProfilePageClient />;
}
