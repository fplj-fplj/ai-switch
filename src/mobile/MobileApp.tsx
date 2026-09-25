import { I18nProvider } from "../lib/i18n";

/**
 * The mobile shell.
 *
 * Android gets its own tree instead of a responsive variant of `App`, because the
 * two are organised around different things. The desktop panel is laid out by CLI
 * platform: seven top-level entries (`Codex`, `Claude`, `Grok`, …) that all render
 * the same `AccountsScreen` with a different `platform` prop. What the backend
 * actually holds is one compute pool, one credential table and one usage stream —
 * the seven platforms are a column in that table, not seven applications. Rewriting
 * the navigation around those resources is the point of this tree, and doing it
 * inside `App` would have dragged the desktop layout along with it.
 *
 * The branch that chooses this tree lives in `ApplicationEntry`, not in `App`:
 * `App()` opens with eight `useState` and four `useEffect`, so an early `return`
 * there would have to come after all of them, and hoisting them out to satisfy the
 * rules of hooks is a much larger change to a file the desktop still uses.
 *
 * What is here now is the skeleton only — the real shell (bottom navigation, the
 * Android back button) arrives with it. It renders the four destinations as a static
 * preview so the information architecture can be looked at on a device before any of
 * it is built, and so the APK built from this commit is not simply blank.
 *
 * The colours are the semantic tokens from `src/styles/tokens.css`, not literal
 * `stone-*` shades. That is what makes this skeleton useful beyond a preview: it is
 * the first real consumer of the token layer, so `tests/designTokens.test.ts` is
 * checking classes something actually renders rather than a list kept in step by
 * hand.
 */

/**
 * Wraps the mobile tree in the i18n provider.
 *
 * `App` mounts its own provider internally, and this tree is `App`'s sibling rather
 * than its child, so without this the provider never mounts on a phone. That matters
 * for more than translations: `I18nProvider` is the only thing that sets
 * `document.documentElement.lang`, and leaving it at the `en` in `index.html` tells
 * screen readers to pronounce Chinese text with an English voice and can change which
 * CJK font the WebView falls back to.
 *
 * Split into a provider and a shell so the provider sits above whatever here
 * eventually calls `useI18n()` — including the shell itself.
 */
export function MobileApp() {
  return (
    <I18nProvider>
      <MobileShell />
    </I18nProvider>
  );
}

/**
 * The four destinations, in the order they will appear in the bottom navigation.
 *
 * Gateway first: on a phone this application's primary job is keeping the gateway
 * alive, not managing credentials.
 */
const DESTINATIONS = [
  { title: "网关", detail: "运行状态、端口、访问 key、启停、实时日志" },
  { title: "凭据", detail: "凭据列表与详情、池成员与分组、导入导出（平台降级为筛选器）" },
  { title: "用量", detail: "总览与趋势、按凭据/模型拆分、价格配置" },
  { title: "设置", detail: "端口与访问、通知、存储、关于、诊断" },
];

/**
 * The layout, and why its height does not come from `min-h-screen`.
 *
 * `#root` is `max-height: 100dvh; overflow: hidden` (src/styles.css), and on Android
 * `100vh` is measured against the large viewport, so a `min-h-screen` child ends up
 * taller than the clipping ancestor allows — the overflow is cut off and cannot be
 * scrolled away, because the clip sits above it. `h-full` + `min-h-0` + an inner
 * scroll container is what the desktop layout already does (AppLayout.tsx:434, :532),
 * and `min-h-0` is load-bearing: without it a flex child refuses to shrink below its
 * content and `overflow-y-auto` never engages.
 *
 * No safe-area padding here either. `#root` already consumes
 * `env(safe-area-inset-*)` for every screen at once, so adding it again would double
 * the inset — the header would float below the status bar with a band of dead space
 * between them.
 */
function MobileShell() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card px-4 py-3">
        <p className="text-[15px] font-semibold">AI Switch</p>
        <p className="text-[12px] text-muted-foreground">移动端界面重写中</p>
      </header>

      <main className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <p className="text-[12px] text-muted-foreground">
          这是新版移动端界面的骨架。下面四个入口按后端资源的真实边界划分，尚未接入功能。
        </p>

        <ul className="space-y-2">
          {DESTINATIONS.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-border bg-card px-3 py-3 shadow-sm"
            >
              <p className="text-[14px] font-semibold">{item.title}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{item.detail}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
