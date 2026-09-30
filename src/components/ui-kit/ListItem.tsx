import type { HTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";

/**
 * The row primitive every mobile screen is built from: credential rows, gateway
 * stats, setting entries. One card-shaped container with three slots — leading
 * icon, main text stack, trailing control — so screens never re-invent the
 * spacing.
 *
 * `asChild` forwards everything onto the caller's element (a `<button>` for a
 * tappable row, a `<div>` for a static one). The interactive classes therefore
 * land on the real element, where `:active` actually fires.
 */
export const listItemVariants = cva(
  "flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left shadow-sm",
  {
    variants: {
      interactive: {
        true: "cursor-pointer select-none touch-manipulation active:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        false: "",
      },
    },
    defaultVariants: { interactive: false },
  },
);

export interface ListItemProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof listItemVariants> {
  asChild?: boolean;
}

export function ListItem({ className, interactive, asChild = false, ...props }: ListItemProps) {
  const Comp = asChild ? Slot : "div";
  return <Comp className={clsx(listItemVariants({ interactive }), className)} {...props} />;
}

export function ListItemMain({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("min-w-0 grow", className)} {...props} />;
}

export function ListItemTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("truncate text-[14px] font-medium text-foreground", className)} {...props} />;
}

export function ListItemSubtitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("truncate text-xs text-muted-foreground", className)} {...props} />;
}

export function ListItemLeading({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("flex shrink-0 items-center", className)} {...props} />;
}

export function ListItemTrailing({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("flex shrink-0 items-center gap-2", className)} {...props} />;
}
