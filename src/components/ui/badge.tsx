import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-bg-muted text-ink",
        pink: "border-trans-pink/40 bg-trans-pink-soft text-trans-pink-deep",
        blue: "border-trans-blue/40 bg-trans-blue-soft text-trans-blue-deep",
        outline: "border-border text-ink-muted",
        warn: "border-amber-300/60 bg-amber-50 text-amber-800",
        success: "border-emerald-300/60 bg-emerald-50 text-emerald-800",
        danger: "border-rose-300/60 bg-rose-50 text-rose-800",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
