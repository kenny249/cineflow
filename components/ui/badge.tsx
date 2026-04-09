import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",
        // Status variants
        active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
        delivered: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
        // Type variants
        gold: "bg-[#d4a853]/10 text-[#d4a853] border-[#d4a853]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
