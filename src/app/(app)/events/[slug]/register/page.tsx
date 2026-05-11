import RegisterPageClient from "./RegisterPageClient";
import { getEventStaticParams } from "@/lib/event-static";

export const generateStaticParams = getEventStaticParams;

export default function RegisterPage() {
  return <RegisterPageClient />;
}
