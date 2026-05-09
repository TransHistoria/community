import { Badge } from "@/components/ui/badge";

const LABELS: Record<
  string,
  { label: string; variant: "blue" | "pink" | "default" | "outline" }
> = {
  GUEST: { label: "游客", variant: "outline" },
  UNVERIFIED: { label: "未认证", variant: "outline" },
  VERIFIED: { label: "已认证", variant: "blue" },
  TRUSTED: { label: "信任成员", variant: "pink" },
  ADMIN: { label: "管理员", variant: "pink" },
};

export function TierBadge({ tier }: { tier: string }) {
  const cfg = LABELS[tier] ?? { label: tier, variant: "outline" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
