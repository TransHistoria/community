import RegisterPageClient from "./RegisterPageClient";

export function generateStaticParams() {
  return [{ slug: "placeholder" }];
}

export default function RegisterPage() {
  return <RegisterPageClient />;
}
