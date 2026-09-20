/**
 * A LIFO stack of things the Android back button should close, innermost first.
 *
 * The alternative — lifting every dialog's open flag up to `AppLayout` — would
 * rewrite the props chain of dozens of components that already have an `onClose`.
 * Registering on mount and unregistering on unmount expresses the same ordering
 * with none of that, and keeps "what closes this" inside the component that owns
 * it.
 */
type BackHandler = () => void;

const handlers: BackHandler[] = [];

/**
 * Registers a handler for as long as the caller is mounted, and returns the
 * unregister function — so `useEffect(() => pushBackHandler(onClose), [onClose])`
 * works directly.
 */
export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.lastIndexOf(handler);
    if (index >= 0) {
      handlers.splice(index, 1);
    }
  };
}

/**
 * Runs the innermost handler and reports whether there was one. `false` means
 * nothing on screen wanted the press, so the caller is free to fall back to its
 * own navigation — or let the system finish the activity.
 */
export function runTopBackHandler(): boolean {
  const handler = handlers[handlers.length - 1];
  if (!handler) {
    return false;
  }
  handler();
  return true;
}