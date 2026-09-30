import type { ComponentProps } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { clsx } from "clsx";

/**
 * Boolean toggle for setting rows. The root carries `role="switch"` and the
 * checked state from Radix; `ListItemTrailing` is the only place this is meant
 * to be dropped, and it is `shrink-0` so a long title cannot squeeze it.
 *
 * Track 24×40 with a 20px thumb travelling 2px → 16px: the thumb stays inside
 * the track at both ends, and the 44px-tall row around it satisfies the touch
 * target even though the switch itself is smaller.
 *
 * `bg-input` unchecked, `data-[state=checked]:bg-primary` checked — both semantic
 * tokens, no alpha arithmetic (UnoCSS drops `/alpha` on `var()`-mapped colours).
 */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={clsx(
        "relative h-6 w-10 shrink-0 cursor-pointer touch-manipulation select-none rounded-full bg-input transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={clsx(
          "block h-5 w-5 rounded-full bg-white transition-transform translate-x-0.5 data-[state=checked]:translate-x-4",
        )}
      />
    </SwitchPrimitive.Root>
  );
}