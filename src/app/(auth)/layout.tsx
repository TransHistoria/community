import AuthFrame from "./AuthFrame";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthFrame>{children}</AuthFrame>;
}
