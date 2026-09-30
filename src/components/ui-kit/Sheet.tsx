import type { ComponentProps } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { clsx } from "clsx";

/**
 * Bottom sheet — the mobile replacement for the desktop dialogs (see the spec's
 * "形态变化：对话框 → 全屏面板" section). Built on Radix Dialog so focus trap,
 * Escape, and outside-dismiss all come from the primitive instead of bespoke
 * code; the only visual decisions are the ones below.
 *
 * Geometry: pinned to the bottom edge, capped at 85dvh, and scrolling happens in
 * `SheetBody` — never on the content box itself. `overflow-hidden` on the frame
 * plus `min-h-0 grow overflow-y-auto` on the body is the same clip contract the
 * shell uses against `#root`'s `max-height: 100dvh`; a sheet that scrolled its
 * own frame would take the header and footer with it.
 *
 * No safe-area padding anywhere in here: `#root` already consumes
 * `env(safe-area-inset-*)`, so adding more would double the inset.
 *
 * The scrim uses `bg-black/50` — a palette colour, where UnoCSS keeps the alpha.
 * Semantic tokens lose it (they map straight onto a `var()`), which is why press
 * states elsewhere in this kit use `active:opacity-90` instead of `/90`.
 */
export function Sheet(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}

export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        className={clsx(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card text-card-foreground shadow-sm",
          className,
        )}
        {...props}
      >
        <div aria-hidden="true" className="mx-auto my-2 h-1 w-9 shrink-0 rounded-full bg-border" />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Title block on the left, dismiss affordance on the right. */
export function SheetHeader({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={clsx("flex shrink-0 items-center justify-between gap-3 px-4 pb-4 pt-2 text-left", className)}
      {...props}
    >
      <div className="min-w-0 grow">{children}</div>
      <SheetClose />
    </div>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={clsx("truncate text-[15px] font-semibold text-foreground", className)} {...props} />;
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={clsx("text-xs text-muted-foreground", className)} {...props} />;
}

export function SheetBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("min-h-0 grow overflow-y-auto px-4 pb-4", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("shrink-0 border-t border-border px-4 py-3", className)} {...props} />;
}

/**
 * The default `aria-label` is hardcoded Chinese, matching the temporary strings
 * in `MobileApp.tsx`; screens pass their own `aria-label` (spread after the
 * default, so it wins) once the i18n keys land in P3.
 */
export function SheetClose({ className, ...props }: ComponentProps<typeof DialogPrimitive.Close>) {
  return (
    <DialogPrimitive.Close
      aria-label="关闭"
      className={clsx(
        "flex h-9 w-9 shrink-0 touch-manipulation select-none items-center justify-center rounded-full bg-transparent text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-90 disabled:pointer-events-none",
        className,
      )}
      {...props}
    >
      <X className="h-5 w-5" />
    </DialogPrimitive.Close>
  );
}