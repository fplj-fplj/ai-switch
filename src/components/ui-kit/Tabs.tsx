import type { ComponentProps } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { clsx } from "clsx";

/**
 * Underline tabs for the credential detail panes. Radix supplies the
 * `data-state` / `aria-selected` bookkeeping; the styling hangs off
 * `data-[state=active]`, which `tests/designTokens.test.ts` already pins for
 * presetUno (the same attribute syntax shadcn relies on).
 *
 * The list is a horizontal scroll strip rather than a wrap: a credential can
 * carry more platforms than fit a phone width, and wrapping would push the
 * content pane down unpredictably.
 */
export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={clsx("flex w-full grow flex-col gap-3", className)} {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={clsx("flex shrink-0 gap-1 overflow-x-auto border-b border-border", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={clsx(
        "touch-manipulation select-none whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={clsx("min-h-0 grow focus:outline-none", className)} {...props} />;
}