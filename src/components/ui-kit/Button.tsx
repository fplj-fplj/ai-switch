import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

/**
 * The mobile button. Deliberately separate from `src/components/ui/Button.tsx`:
 * the desktop one is hard-coded to slate/stone literals and stays byte-identical
 * (the zero-regression red line). This one speaks semantic tokens so the whole
 * mobile tree can rest on `src/styles/tokens.css`.
 *
 * Press feedback never uses the `/alpha` modifier on semantic colours — UnoCSS
 * drops the alpha silently for `var()`-mapped tokens (see the spec's semantic
 * token section), so `active:bg-primary/90` would render as the flat colour.
 * `active:opacity-90` and solid `active:bg-accent` are what works.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-semibold select-none touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 active:opacity-90",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground",
        ghost: "border-transparent bg-transparent text-foreground active:bg-accent",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
      },
      size: {
        sm: "h-9 px-3 text-[13px]",
        md: "h-11 px-4 text-[14px]",
        lg: "h-12 px-5 text-[15px]",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={clsx(buttonVariants({ variant, size }), className)} {...props} />;
}
