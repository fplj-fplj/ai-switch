import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { onBackButtonPress } from "@tauri-apps/api/app";
import type { PluginListener } from "@tauri-apps/api/core";
import { motion } from "motion/react";
import {
  ChevronDown,
  Info,
  Images,
  Menu,
  PlugZap,
  Settings2,
  Sparkles,
  TerminalSquare,
  type LucideIcon,
} from "lucide-react";
import { AiSwitchLogo } from "../brand/AiSwitchLogo";
import { AgentIcon, type AgentIconPlatform } from "../brand/AgentIcon";
import {
  createDefaultAgentVisibility,
  readAgentVisibility,
  writeAgentVisibility,
  type AgentPlatform,
  type AgentVisibility,
} from "../../lib/agentVisibility";
import { useI18n } from "../../lib/i18n";
import { isAndroidApp } from "../../lib/platform";
import { runTopBackHandler } from "../../lib/backHandler";
import { requestAppExit, resolveBackAction } from "../../lib/backNavigation";
import { isScreenAvailable } from "../../lib/screenAvailability";
import { useDragResize } from "../../lib/useDragResize";

export {
  agentPlatforms,
  agentScreenByPlatform,
  platformByAgentScreen,
  type AgentPlatform,
  type AgentVisibility,
} from "../../lib/agentVisibility";

export const settingsFeatureScreens = [
  "Sessions",
  "Updates",
  "Log",
] as const;

const SIDEBAR_DEFAULT_WIDTH = 216;
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 320;
const SIDEBAR_WIDTH_STORAGE_KEY = "ai-switch.sidebar-width";
const SIDEBAR_DRAWER_BREAKPOINT = 600;

function clampSidebarWidth(value: number) {
  return Math.min(Math.max(value, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH);
}

function readSidebarWidth() {
  if (typeof window === "undefined") {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  try {
    const rawValue = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (!rawValue) {
      return SIDEBAR_DEFAULT_WIDTH;
    }
    const storedValue = Number(rawValue);
    return Number.isFinite(storedValue) ? clampSidebarWidth(storedValue) : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

type AppLayoutProps = {
  children: ReactNode;
  activeScreen: string;
  onNavigate: (screen: string) => void;
  onOpenVibe?: () => void;
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
  agentVisibility?: AgentVisibility;
  onAgentVisibilityChange?: (visibility: AgentVisibility) => void;
  saasEnabled?: boolean;
};

type AgentNavItem = {
  icon: AgentIconPlatform;
  screen: string;
  platform: AgentPlatform;
  labelKey:
    | "nav.agent.codex"
    | "nav.agent.claude"
    | "nav.agent.grok"
    | "nav.agent.gemini"
    | "nav.agent.opencode"
    | "nav.agent.openclaw"
    | "nav.agent.hermes";
};

const agentItems: AgentNavItem[] = [
  { icon: "codex", screen: "Codex", platform: "codex", labelKey: "nav.agent.codex" },
  { icon: "claude", screen: "Claude", platform: "claude", labelKey: "nav.agent.claude" },
  { icon: "grok", screen: "Grok", platform: "grok", labelKey: "nav.agent.grok" },
  { icon: "gemini", screen: "Gemini", platform: "gemini", labelKey: "nav.agent.gemini" },
  { icon: "opencode", screen: "OpenCode", platform: "opencode", labelKey: "nav.agent.opencode" },
  { icon: "openclaw", screen: "OpenClaw", platform: "openclaw", labelKey: "nav.agent.openclaw" },
  { icon: "hermes", screen: "Hermes", platform: "hermes", labelKey: "nav.agent.hermes" },
];

function isSettingsArea(screen: string) {
  return screen === "Settings" || (settingsFeatureScreens as readonly string[]).includes(screen);
}

function NavButton({
  collapsed,
  icon,
  label,
  active,
  onClick,
  variant = "standard",
}: {
  collapsed: boolean;
  icon: LucideIcon | AgentIconPlatform;
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: "primary" | "standard";
}) {
  const baseClasses = `group flex w-full items-center rounded-xl border py-2 text-left text-[13px] motion-control duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
    collapsed ? "justify-center px-0" : "justify-between px-3"
  }`;
  const activeClasses =
    variant === "primary"
      ? "border-stone-300 bg-white text-stone-950 shadow-sm"
      : "border-stone-300 bg-stone-100 text-stone-950 shadow-sm";
  const idleClasses =
    variant === "primary"
      ? "border-transparent bg-transparent text-stone-600 hover:bg-white/60 hover:text-stone-950"
      : "border-transparent bg-transparent text-stone-600 hover:bg-stone-100 hover:text-stone-950";
  const LucideIconComponent = typeof icon === "string" ? null : icon;

  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`relative ${baseClasses} ${active ? activeClasses : idleClasses}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {active ? (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 left-0.5 w-0.5 rounded-full bg-amber-500"
          layoutId="app-sidebar-active-indicator"
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        />
      ) : null}
      <span
        className={`relative z-10 flex min-w-0 items-center ${collapsed ? "justify-center gap-0" : "gap-2"}`}
      >
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${collapsed ? "hidden" : ""} ${
            active ? "bg-amber-500" : "bg-stone-300 group-hover:bg-stone-400"
          }`}
        />
        {typeof icon === "string" ? (
          <AgentIcon className="h-4 w-4" platform={icon} />
        ) : (
          LucideIconComponent ? (
            <LucideIconComponent aria-hidden="true" className={`h-4 w-4 shrink-0 ${active ? "text-amber-600" : "text-stone-500"}`} />
          ) : null
        )}
        <span className={`truncate font-medium ${collapsed ? "sr-only" : ""}`}>{label}</span>
      </span>
      <span
        aria-hidden="true"
        className={`${collapsed ? "hidden" : ""} ${
          active ? "text-stone-400" : "text-transparent"
        }`}
      >
        /
      </span>
    </button>
  );
}

/**
 * One destination in the narrow-layout bottom bar.
 *
 * Not `NavButton`: that is a list row for the sidebar, and it carries a shared
 * `layoutId` indicator that two instances of would fight over. This is an icon
 * above a label, sized so four fit across a phone.
 */
function BottomNavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon | AgentIconPlatform;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const LucideIconComponent = typeof icon === "string" ? null : icon;

  return (
    <button
      aria-current={active ? "page" : undefined}
      className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 motion-control focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        active ? "bg-white text-stone-950 shadow-sm" : "text-stone-500 hover:bg-white/70"
      }`}
      onClick={onClick}
      title={label}
      type="button"
    >
      {typeof icon === "string" ? (
        <AgentIcon className="h-5 w-5" platform={icon} />
      ) : LucideIconComponent ? (
        <LucideIconComponent
          aria-hidden="true"
          className={`h-5 w-5 ${active ? "text-amber-600" : ""}`}
        />
      ) : null}
      <span className="w-full truncate text-center text-[11px] font-medium">{label}</span>
    </button>
  );
}

export function AppLayout({
  children,
  activeScreen,
  onNavigate,
  onOpenVibe,
  onToggleSidebar,
  sidebarCollapsed,
  agentVisibility,
  onAgentVisibilityChange,
  saasEnabled = false,
}: AppLayoutProps) {
  const { t } = useI18n();
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const bottomNavRef = useRef<HTMLElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [narrowLayout, setNarrowLayout] = useState(
    () => typeof window !== "undefined" && window.innerWidth < SIDEBAR_DRAWER_BREAKPOINT,
  );
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  const [localAgentVisibility, setLocalAgentVisibility] = useState(readAgentVisibility);
  const [agentVisibilityOpen, setAgentVisibilityOpen] = useState(false);
  const settingsActive = isSettingsArea(activeScreen);
  const accountWorkspaceActive = agentItems.some((item) => item.screen === activeScreen);
  const effectiveAgentVisibility = agentVisibility ?? localAgentVisibility;
  const visibleAgentItems = agentItems.filter((item) => effectiveAgentVisibility[item.platform]);
  // The bottom bar's first destination is whichever agent screen is showing, so it
  // follows the user's own visibility choices rather than pinning one platform.
  const activeAgentItem =
    visibleAgentItems.find((item) => item.screen === activeScreen) ?? visibleAgentItems[0];
  const sidebarDrawerVisible = narrowLayout && sidebarDrawerOpen;
  const sidebarContentCollapsed = narrowLayout ? !sidebarDrawerOpen : sidebarCollapsed;
  const desktopGridClass = sidebarCollapsed
    ? "min-[600px]:grid-cols-[56px_minmax(0,1fr)]"
    : "min-[600px]:grid-cols-[var(--app-sidebar-width)_minmax(0,1fr)]";
  const { dragging: sidebarResizing, startDragging: startSidebarResize } = useDragResize({
    axis: "x",
    min: SIDEBAR_MIN_WIDTH,
    max: SIDEBAR_MAX_WIDTH,
    getInitialValue: () => sidebarWidth,
    getValueFromPointer: (event) => {
      const shellRect = appShellRef.current?.getBoundingClientRect();
      return shellRect ? event.clientX - shellRect.left : sidebarWidth;
    },
    onChange: setSidebarWidth,
  });

  // Android's back button finishes the activity by default, so without this the
  // phone quits the app from inside a dialog, from behind the open drawer, and
  // from every screen that is not Settings — three things the button is expected
  // to close instead. Registered only on Android: no other build has the button.
  //
  // `onBackButtonPress` cancels the default finish just by being registered, so
  // the handler has no return value to send; it only decides what to do.
  // Innermost first: an open dialog, then the drawer, then the screen fallback.
  useEffect(() => {
    if (!isAndroidApp()) {
      return;
    }
    let disposed = false;
    // `onBackButtonPress` resolves to Tauri's `PluginListener`, not a bare
    // unsubscribe function — cleanup must go through `unregister()`.
    let unlisten: PluginListener | undefined;
    void onBackButtonPress(() => {
      // Innermost first: an open dialog, then the drawer, then the Settings
      // fallback. At the Settings root there is nothing left to close, so the
      // finish Android would normally perform has to be asked for explicitly —
      // registering this listener is what cancelled it.
      const action = resolveBackAction({
        handlerConsumed: runTopBackHandler(),
        drawerVisible: sidebarDrawerVisible,
        settingsActive,
      });

      if (action === "drawer") {
        setSidebarDrawerOpen(false);
      } else if (action === "settings") {
        onNavigate("settings");
      } else if (action === "exit") {
        void requestAppExit();
      }
    }).then((dispose) => {
      if (disposed) {
        void dispose.unregister();
      } else {
        unlisten = dispose;
      }
    });
    return () => {
      disposed = true;
      void unlisten?.unregister();
    };
  }, [onNavigate, settingsActive, sidebarDrawerVisible]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clampSidebarWidth(sidebarWidth)));
    } catch {
      // Storage may be unavailable in restricted webviews.
    }
  }, [sidebarWidth]);

  useEffect(() => {
    const syncNarrowLayout = () => {
      const nextNarrowLayout = window.innerWidth < SIDEBAR_DRAWER_BREAKPOINT;
      setNarrowLayout(nextNarrowLayout);
      if (!nextNarrowLayout) {
        setSidebarDrawerOpen(false);
      }
    };
    syncNarrowLayout();
    window.addEventListener("resize", syncNarrowLayout);
    return () => window.removeEventListener("resize", syncNarrowLayout);
  }, []);

  // Publishes the bar's height for the overlays to inset themselves by.
  //
  // They are anchored to the viewport, and the bar is a grid row inside the shell
  // rather than an overlay — so without this a drawer runs underneath it and the last
  // few centimetres of a long form cannot be reached, however far you scroll. The
  // height is measured rather than assumed: the bar holds a safe-area-padded row and
  // its buttons carry their own labels.
  useEffect(() => {
    const root = document.documentElement;
    const element = bottomNavRef.current;
    if (!narrowLayout || !element) {
      root.style.removeProperty("--bottom-nav-height");
      return;
    }

    const publish = () => {
      root.style.setProperty("--bottom-nav-height", `${element.offsetHeight}px`);
    };
    publish();

    // jsdom has no ResizeObserver, and the height only changes when the bar does.
    if (typeof ResizeObserver === "undefined") {
      return () => root.style.removeProperty("--bottom-nav-height");
    }
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--bottom-nav-height");
    };
  }, [narrowLayout]);

  useEffect(() => {
    if (!sidebarDrawerVisible) {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarDrawerVisible]);

  const handleToggleSidebar = () => {
    if (narrowLayout) {
      setSidebarDrawerOpen((current) => !current);
      return;
    }
    onToggleSidebar();
  };

  const handleNavigate = (nextScreen: string) => {
    setSidebarDrawerOpen(false);
    onNavigate(nextScreen);
  };

  const handleAgentVisibilityChange = (platform: AgentPlatform, visible: boolean) => {
    const nextVisibility = { ...effectiveAgentVisibility, [platform]: visible };
    if (onAgentVisibilityChange) {
      onAgentVisibilityChange(nextVisibility);
    } else {
      setLocalAgentVisibility(nextVisibility);
    }
  };

  const restoreAgentVisibility = () => {
    const nextVisibility = Object.fromEntries(
      agentItems.map((item) => [item.platform, true]),
    ) as AgentVisibility;
    if (onAgentVisibilityChange) {
      onAgentVisibilityChange(nextVisibility);
    } else {
      setLocalAgentVisibility(nextVisibility);
    }
  };

  useEffect(() => {
    writeAgentVisibility(effectiveAgentVisibility);
  }, [effectiveAgentVisibility]);

  const handleOpenVibe = () => {
    setSidebarDrawerOpen(false);
    onOpenVibe?.();
  };

  return (
    // `h-full`, not `h-screen`: `#root` carries the safe-area padding, so its
    // content box is already the viewport minus the system bars. Sizing this to
    // 100vh instead made it taller than its parent by the insets, and `#root`
    // clips overflow — which silently cut the bottom inset's worth of pixels off
    // the bottom navigation, labels included, on any device that reports insets.
    <main className="box-border h-full max-h-full min-h-0 overflow-hidden text-stone-950">
      <div
        className={`app-shell box-border grid h-full min-h-0 ${
          narrowLayout
            ? "grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto]"
            : "grid-cols-[56px_minmax(0,1fr)]"
        } ${desktopGridClass}`}
        data-testid="app-shell"
        ref={appShellRef}
        style={
          {
            "--app-sidebar-width": `${sidebarContentCollapsed ? 56 : sidebarWidth}px`,
          } as CSSProperties
        }
      >
        {sidebarDrawerVisible && (
          <div
            aria-hidden="true"
            className="app-sidebar-drawer-backdrop"
            data-testid="app-sidebar-drawer-backdrop"
            onClick={() => setSidebarDrawerOpen(false)}
          />
        )}
        <aside
          // Narrow layouts navigate from the bottom bar, so the rail gives its
          // column back to the content. The drawer still opens over everything —
          // it is `position: fixed`, so it never needed a grid cell.
          //
          // `hidden` and `flex` are mutually exclusive here on purpose: UnoCSS
          // orders its utilities by its own rule order, not by this string, and
          // `flex` is emitted after `hidden` — so listing both leaves the rail
          // laid out and intercepting taps despite the `hidden` class.
          className={`app-sidebar ${
            narrowLayout && !sidebarDrawerVisible ? "hidden" : "flex"
          } ${
            sidebarDrawerVisible ? "app-sidebar-drawer" : "relative"
          } h-full min-h-0 flex-col overflow-hidden border-r border-white/80 bg-gradient-to-br from-slate-50/92 via-emerald-50/74 to-amber-50/70 shadow-xl shadow-stone-900/5 backdrop-blur-2xl ${
            sidebarContentCollapsed ? "p-2" : "p-3"
          }`}
          data-testid="app-sidebar"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(16,185,129,0.18),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(245,158,11,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.38))]" />
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div
              className={`flex justify-between rounded-2xl border border-white/80 bg-white/56 shadow-sm backdrop-blur-xl ${
                sidebarContentCollapsed
                  ? "mb-4 flex-col items-center gap-2 p-1"
                  : "mb-5 items-start gap-3 p-3"
              }`}
            >
              <div
                className={`min-w-0 items-center gap-2 ${
                  sidebarContentCollapsed ? "hidden" : "flex"
                }`}
              >
                <AiSwitchLogo className="h-9 w-9 shrink-0 rounded-2xl shadow-sm" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-stone-950">AI Switch</p>
                  <p className="truncate text-[11px] text-stone-500">{t("layout.brandBadge")}</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-2 ${
                  sidebarContentCollapsed ? "flex-col" : ""
                }`}
              >
                <button
                  aria-expanded={!sidebarContentCollapsed}
                  aria-label={
                    sidebarContentCollapsed
                      ? t("layout.expandSidebar")
                      : t("layout.collapseSidebar")
                  }
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white/70 text-stone-600 shadow-sm motion-control hover:border-stone-300 hover:bg-white hover:text-stone-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  onClick={handleToggleSidebar}
                  title={
                    sidebarContentCollapsed
                      ? t("layout.expandSidebar")
                      : t("layout.collapseSidebar")
                  }
                  type="button"
                >
                  <Menu aria-hidden="true" className="h-4 w-4" />
                </button>
                {isScreenAvailable("Vibe") && (
                  <button
                    aria-label={t("layout.switchToVibe")}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-stone-200 bg-white/70 text-stone-600 shadow-sm motion-control hover:border-stone-300 hover:bg-white hover:text-stone-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    onClick={handleOpenVibe}
                    title={t("layout.switchToVibe")}
                    type="button"
                  >
                    <TerminalSquare aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
              <section>
                <div className={`flex items-center justify-between px-2 pb-1 ${sidebarContentCollapsed ? "hidden" : ""}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wide text-stone-400 ${sidebarContentCollapsed ? "hidden" : ""}`}>
                    {t("layout.agents")}
                  </p>
                  <div className="relative">
                    <button
                      aria-expanded={agentVisibilityOpen}
                      aria-label={t("layout.agentVisibility")}
                      className="inline-flex items-center gap-0.5 rounded p-0.5 text-stone-400 hover:bg-white/70 hover:text-stone-700"
                      onClick={() => setAgentVisibilityOpen((current) => !current)}
                      title={t("layout.agentVisibility")}
                      type="button"
                    >
                      <Settings2 aria-hidden="true" className="h-3.5 w-3.5" />
                      <ChevronDown aria-hidden="true" className={`h-3 w-3 motion-control ${agentVisibilityOpen ? "rotate-180" : ""}`} />
                    </button>
                    {agentVisibilityOpen ? (
                      <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                        {agentItems.map((item) => (
                          <label className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-stone-700" key={item.platform}>
                            <input
                              aria-label={t("settings.agentVisibility.show", { agent: t(item.labelKey) })}
                              checked={effectiveAgentVisibility[item.platform]}
                              className="accent-blue-600"
                              onChange={(event) => handleAgentVisibilityChange(item.platform, event.target.checked)}
                              type="checkbox"
                            />
                            {t(item.labelKey)}
                          </label>
                        ))}
                        <button
                          className="mt-1 w-full border-t border-stone-100 px-2 pt-2 text-left text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                          onClick={restoreAgentVisibility}
                          type="button"
                        >
                          {t("layout.restoreAgentVisibility")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-1">
                  {visibleAgentItems.map((item) => (
                    <NavButton
                      active={activeScreen === item.screen}
                      collapsed={sidebarContentCollapsed}
                      icon={item.icon}
                      key={item.screen}
                      label={t(item.labelKey)}
                      onClick={() => handleNavigate(item.screen)}
                      variant="primary"
                    />
                  ))}
                </div>
              </section>

              <section>
                <p
                  className={`px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400 ${
                    sidebarContentCollapsed ? "hidden" : ""
                  }`}
                >
                  {t("layout.system")}
                </p>
                {saasEnabled && (
                  <NavButton
                    active={activeScreen === "SaaS"}
                    collapsed={sidebarContentCollapsed}
                    icon={PlugZap}
                    label="SaaS"
                    onClick={() => handleNavigate("SaaS")}
                  />
                )}
                {isScreenAvailable("ImageGen") && (
                  <NavButton
                    active={activeScreen === "ImageGen"}
                    collapsed={sidebarContentCollapsed}
                    icon={Images}
                    label={t("nav.imagegen")}
                    onClick={() => handleNavigate("ImageGen")}
                  />
                )}
                {isScreenAvailable("MCP") && (
                  <NavButton
                    active={activeScreen === "MCP"}
                    collapsed={sidebarContentCollapsed}
                    icon={PlugZap}
                    label={t("nav.mcp")}
                    onClick={() => handleNavigate("MCP")}
                  />
                )}
                {isScreenAvailable("Skills") && (
                  <NavButton
                    active={activeScreen === "Skills"}
                    collapsed={sidebarContentCollapsed}
                    icon={Sparkles}
                    label={t("nav.skills")}
                    onClick={() => handleNavigate("Skills")}
                  />
                )}
                <NavButton
                  active={settingsActive}
                  collapsed={sidebarContentCollapsed}
                  icon={Settings2}
                  label={t("nav.settings")}
                  onClick={() => handleNavigate("Settings")}
                />
                <NavButton
                  active={activeScreen === "About"}
                  collapsed={sidebarContentCollapsed}
                  icon={Info}
                  label={t("nav.about")}
                  onClick={() => handleNavigate("About")}
                />
              </section>
            </div>
          </div>
          {!narrowLayout && !sidebarCollapsed && (
            <div
              aria-label={t("layout.resizeSidebar")}
              aria-orientation="vertical"
              aria-valuemax={SIDEBAR_MAX_WIDTH}
              aria-valuemin={SIDEBAR_MIN_WIDTH}
              aria-valuenow={sidebarWidth}
              className={`absolute inset-y-0 right-0 z-20 w-1.5 touch-none select-none cursor-col-resize bg-transparent motion-control hover:bg-stone-300/70 ${
                sidebarResizing ? "bg-blue-400/70" : ""
              }`}
              data-testid="sidebar-resize-handle"
              onPointerDown={startSidebarResize}
              role="separator"
              title={t("layout.resizeSidebar")}
            />
          )}
        </aside>

        <section
          className={`${
            narrowLayout ? "col-start-1 row-start-1" : "col-start-2"
          } box-border h-full min-h-0 min-w-0 bg-stone-100 ${
            accountWorkspaceActive ? "overflow-hidden p-0" : "overflow-y-auto p-2 sm:p-3"
          }`}
        >
          {children}
        </section>

        {/* Narrow layouts navigate from the bottom. The rail is hidden above so the
            content gets that column; the drawer still exists, and re-tapping the agent
            you are already on opens it — that is where the full agent list and the
            per-agent visibility switches live, and it is the only thing the drawer
            still offers that this bar does not. A grid row rather than a fixed bar, so
            it cannot cover the content and it inherits `#root`'s safe-area padding. */}
        {narrowLayout && (
          <nav
            aria-label={t("layout.primary")}
            className="col-start-1 row-start-2 flex items-stretch gap-1 border-t border-stone-200 bg-white/85 px-1.5 py-1.5 backdrop-blur-xl"
            data-testid="app-bottom-nav"
            ref={bottomNavRef}
          >
            {activeAgentItem ? (
              <BottomNavButton
                // Lit while the drawer is open as well, so a tap that opens it has
                // some acknowledgement — it is otherwise a tap that appears to do
                // nothing, because the screen behind it does not change.
                active={accountWorkspaceActive || sidebarDrawerOpen}
                icon={activeAgentItem.icon}
                label={t(activeAgentItem.labelKey)}
                onClick={() => {
                  if (accountWorkspaceActive) {
                    setSidebarDrawerOpen(true);
                    return;
                  }
                  handleNavigate(activeAgentItem.screen);
                }}
              />
            ) : null}
            <BottomNavButton
              active={settingsActive}
              icon={Settings2}
              label={t("nav.settings")}
              onClick={() => handleNavigate("Settings")}
            />
            <BottomNavButton
              active={activeScreen === "About"}
              icon={Info}
              label={t("nav.about")}
              onClick={() => handleNavigate("About")}
            />
          </nav>
        )}
      </div>
    </main>
  );
}
