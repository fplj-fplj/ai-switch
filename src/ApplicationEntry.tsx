import { App } from "./App";

/**
 * The only entry point left.
 *
 * This used to branch into a hosted "portal" mode when the SaaS plugin was
 * enabled, which is why it was a separate file from `App`. That plugin is gone,
 * so there is nothing to branch on — the admin panel is the whole application.
 */
export function ApplicationEntry() {
  return <App />;
}
