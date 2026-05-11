import ManageEventPageClient from "./ManageEventPageClient";

export function generateStaticParams() {
  return [{ slug: "placeholder" }];
}

export default function ManageEventPage() {
  return <ManageEventPageClient />;
}
